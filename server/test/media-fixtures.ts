import { deflateSync, crc32 } from 'node:zlib';

function pngChunk(type: string, bytes: Buffer) {
  const header = Buffer.alloc(4); header.writeUInt32BE(bytes.length);
  const content = Buffer.concat([Buffer.from(type), bytes]);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(content));
  return Buffer.concat([header, content, checksum]);
}

export function tinyPng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.from([0,20,120,80]))), pngChunk('IEND', Buffer.alloc(0))]);
}

export function tinyPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 120] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 14 Tf 20 60 Td (Cloud Media Vault - prueba) Tj ET';
  objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  let text = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(text);
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  text += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text);
}

// Contenedores estructurales para pruebas del detector; no son fixtures de reproducción.
export function structuralMp4(): Buffer {
  const box = (name: string, data: Buffer) => {
    const size = Buffer.alloc(4); size.writeUInt32BE(data.length + 8);
    return Buffer.concat([size, Buffer.from(name), data]);
  };
  return Buffer.concat([box('ftyp', Buffer.from('isom\0\0\0\0isommp42')), box('moov', Buffer.alloc(0)), box('mdat', Buffer.from([0]))]);
}

export function multerFile(buffer: Buffer, name = 'prueba.png', mime = 'image/png'): Express.Multer.File {
  return { buffer, originalname: name, mimetype: mime, size: buffer.length, fieldname: 'archivo', encoding: '7bit' } as Express.Multer.File;
}
