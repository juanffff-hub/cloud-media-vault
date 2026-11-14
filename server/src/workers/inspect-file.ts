import { parentPort } from 'node:worker_threads';
import { fileTypeFromBuffer } from 'file-type';

function completeContainer(bytes: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes.length > 20 && bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]));
  if (mime === 'image/webp') return bytes.length > 20 && bytes.readUInt32LE(4) + 8 === bytes.length;
  if (mime === 'application/pdf') {
    return bytes.length > 40 && bytes.subarray(0, 8).toString().startsWith('%PDF-') &&
      /%%EOF\s*$/.test(bytes.subarray(-1024).toString());
  }
  if (mime === 'image/png') {
    let offset = 8;
    let data = false;
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (size > bytes.length - offset - 12) return false;
      if (offset === 8 && (type !== 'IHDR' || size !== 13)) return false;
      if (type === 'IDAT' && size > 0) data = true;
      offset += size + 12;
      if (type === 'IEND') return data && size === 0 && offset === bytes.length;
    }
    return false;
  }
  if (mime === 'video/mp4') {
    let offset = 0;
    const boxes = new Set<string>();
    while (offset + 8 <= bytes.length) {
      let size = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > bytes.length) return false;
        const large = bytes.readBigUInt64BE(offset + 8);
        if (large > BigInt(bytes.length)) return false;
        size = Number(large); header = 16;
      } else if (size === 0) size = bytes.length - offset;
      if (size < header || offset + size > bytes.length) return false;
      boxes.add(type); offset += size;
    }
    return offset === bytes.length && ['ftyp', 'moov', 'mdat'].every(box => boxes.has(box));
  }
  if (mime === 'video/webm') {
    return bytes.includes(Buffer.from([0x18, 0x53, 0x80, 0x67])) && bytes.includes(Buffer.from([0x1f, 0x43, 0xb6, 0x75]));
  }
  return false;
}

parentPort?.once('message', async (input: Uint8Array) => {
  try {
    const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    const result = await fileTypeFromBuffer(bytes);
    parentPort?.postMessage(result && completeContainer(bytes, result.mime) ? { mime: result.mime } : null);
  } catch { parentPort?.postMessage(null); }
});
