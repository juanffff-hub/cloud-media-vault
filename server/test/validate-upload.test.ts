import { expect, test } from 'vitest';
import { validateUpload } from '../src/services/validate-upload.js';
import { multerFile, tinyPng, tinyPdf, structuralMp4 } from './media-fixtures.js';

const fields = { titulo: '  Mi archivo  ', subidoPor: '  David Neira  ' };

test.each([
  [tinyPng, 'FOTO.PNG', 'image/png', 'imagen', 'image'],
  [tinyPdf, 'archivo.pdf', 'application/pdf', 'pdf', 'image'],
  [structuralMp4, 'clip.mp4', 'video/mp4', 'video', 'video'],
] as const)('valida MIME, extensión y estructura (%s)', async (bytes, name, mime, category, type) => {
  const result = await validateUpload(fields, multerFile(bytes(), name, mime));
  expect(result).toMatchObject({ titulo: 'Mi archivo', subidoPor: 'David Neira', categoria: category, resourceType: type });
});

test.each([
  {}, { titulo: 'a' }, { ...fields, titulo: '' }, { ...fields, subidoPor: ' ' },
  { ...fields, titulo: ['a','b'] }, { ...fields, titulo: 'a'.repeat(161) },
  { ...fields, subidoPor: 'a'.repeat(101) }, { ...fields, publicId: 'otro' }, { ...fields, titulo: 'a\0b' },
])('rechaza formulario incompleto o mal formado', async body => {
  await expect(validateUpload(body, multerFile(tinyPng()))).rejects.toMatchObject({ status: 400, code: 'INVALID_FORM' });
});

test('archivo ausente o vacío produce 400', async () => {
  await expect(validateUpload(fields)).rejects.toMatchObject({ code: 'FILE_REQUIRED' });
  await expect(validateUpload(fields, multerFile(Buffer.alloc(0)))).rejects.toMatchObject({ code: 'FILE_REQUIRED' });
});

test.each([
  [tinyPng(), 'a.png', 'text/plain'], [tinyPng(), 'a.pdf', 'image/png'],
  [tinyPdf(), 'a.png', 'image/png'], [Buffer.from('not a PNG'), 'a.png', 'image/png'],
  [tinyPng().subarray(0, 25), 'a.png', 'image/png'], [tinyPdf().subarray(0, 30), 'a.pdf', 'application/pdf'],
  [structuralMp4().subarray(0, 25), 'a.mp4', 'video/mp4'],
])('rechaza MIME/extensión/firma o contenido incompleto', async (buffer, name, mime) => {
  await expect(validateUpload(fields, multerFile(buffer, name, mime))).rejects.toMatchObject({ status: 400, code: 'INVALID_FILE' });
});

test('el nombre original elimina rutas, controles y caracteres de presentación peligrosos', async () => {
  const result = await validateUpload(fields, multerFile(tinyPng(), '..\\carpeta\\foto<privada>\u202e.png'));
  expect(result.nombreOriginal).toBe('foto_privada__.png');
});

test('una inspección cancelada no continúa hacia cloud', async () => {
  await expect(validateUpload(fields, multerFile(tinyPng()), AbortSignal.abort())).rejects.toMatchObject({ code: 'UPLOAD_CANCELLED' });
});

test('detecta firmas JPEG y WebP con terminación y tamaño coherentes', async () => {
  const jpeg = Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]), Buffer.alloc(24), Buffer.from([0xff,0xd9])]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(12)]);
  webp.writeUInt32LE(webp.length - 8, 4);
  expect((await validateUpload(fields, multerFile(jpeg, 'a.jpeg', 'image/jpeg'))).categoria).toBe('imagen');
  expect((await validateUpload(fields, multerFile(webp, 'a.webp', 'image/webp'))).categoria).toBe('imagen');
  webp.writeUInt32LE(999, 4);
  await expect(validateUpload(fields, multerFile(webp, 'a.webp', 'image/webp'))).rejects.toMatchObject({ code: 'INVALID_FILE' });
});
