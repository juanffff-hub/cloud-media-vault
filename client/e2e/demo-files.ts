import { crc32, deflateSync } from 'node:zlib';
// Imagen original generada para la demo; no utiliza contenido de terceros.
export function landscapePng() {
  const width = 640, height = 400;
  const pixels = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let color = [220 - y * .08, 230 - y * .07, 206 - y * .06];
    if ((x - 460) ** 2 + (y - 90) ** 2 < 37 ** 2) color = [244, 220, 143];
    if (y > 150 + Math.sin(x / 90) * 45) color = [127, 156, 123];
    if (y > 220 + Math.sin(x / 130 + 2) * 55) color = [65, 106, 88];
    if (y > 285 + Math.sin(x / 150) * 20) color = [119 + Math.sin(y / 6) * 5, 158, 151];
    if (x < 180 && y > 310 - x / 5) color = [42, 79, 59];
    const offset = y * (1 + width * 3) + 1 + x * 3;
    color.forEach((value, channel) => { pixels[offset + channel] = Math.round(value); });
  }
  const chunk = (name: string, bytes: Buffer) => {
    const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length);
    const content = Buffer.concat([Buffer.from(name), bytes]); const check = Buffer.alloc(4); check.writeUInt32BE(crc32(content));
    return Buffer.concat([size, content, check]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
