import express from 'express';
import request from 'supertest';
import { expect, test } from 'vitest';
import { createMultipartUpload } from '../src/middleware/multipart.js';
import { errorHandler } from '../src/middleware/errors.js';
import { MAX_UPLOAD_BYTES } from '../src/config/upload.js';

function app() {
  const api = express();
  api.post('/upload', createMultipartUpload(), (req, res) => res.json({
    data: { size: req.file?.size, name: req.file?.originalname, fields: req.body },
  }));
  api.use(errorHandler);
  return api;
}

test('recibe exactamente un archivo y dos campos sin guardar binarios en disco', async () => {
  const response = await request(app()).post('/upload').field('titulo', 'Álbum').field('subidoPor', 'David')
    .attach('archivo', Buffer.from('fixture'), { filename: 'fotografía.png', contentType: 'image/png' });
  expect(response.status).toBe(200);
  expect(response.body.data).toEqual({ size: 7, name: 'fotografía.png', fields: { titulo: 'Álbum', subidoPor: 'David' } });
});

test('acepta exactamente 10 MiB', async () => {
  const response = await request(app()).post('/upload').attach('archivo', Buffer.alloc(MAX_UPLOAD_BYTES), 'limit.png');
  expect(response.status).toBe(200);
  expect(response.body.data.size).toBe(MAX_UPLOAD_BYTES);
});

test('más de 10 MiB responde 413 y permite otra solicitud después del rechazo', async () => {
  const api = app();
  const response = await request(api).post('/upload').attach('archivo', Buffer.alloc(MAX_UPLOAD_BYTES + 1), 'large.png');
  expect(response.status).toBe(413);
  expect(response.body.error.code).toBe('FILE_TOO_LARGE');
  expect((await request(api).post('/upload').attach('archivo', Buffer.from('ok'), 'ok.png')).status).toBe(200);
});

test('rechaza un segundo archivo y un nombre de campo de archivo inesperado', async () => {
  expect((await request(app()).post('/upload').attach('archivo', Buffer.from('a'), 'a.png')
    .attach('archivo', Buffer.from('b'), 'b.png')).status).toBe(400);
  expect((await request(app()).post('/upload').attach('otro', Buffer.from('a'), 'a.png')).status).toBe(400);
});

test('rechaza campos grandes, anidados y un tercer campo', async () => {
  expect((await request(app()).post('/upload').field('titulo', 'a'.repeat(1025))).status).toBe(400);
  expect((await request(app()).post('/upload').field('titulo[999999999]', 'a')).status).toBe(400);
  expect((await request(app()).post('/upload').field('titulo', 'a').field('subidoPor', 'b').field('extra', 'c')).status).toBe(400);
});

test.each([
  ['application/json', '{"titulo":"a"}'],
  ['multipart/form-data', 'no boundary'],
  ['multipart/form-data; boundary=broken', '--broken\r\nContent-Disposition: form-data; name="titulo"\r\n\r\nunfinished'],
])('un multipart inválido responde 400 sin trazas (%s)', async (contentType, body) => {
  const response = await request(app()).post('/upload').set('Content-Type', contentType).send(body);
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('INVALID_MULTIPART');
  expect(response.text).not.toContain('stack');
});

test('la admisión mantiene el cupo hasta terminar la respuesta', async () => {
  const api = express();
  let complete: (() => void) | undefined;
  let accepted!: () => void;
  const ready = new Promise<void>(resolve => { accepted = resolve; });
  api.post('/upload', createMultipartUpload({ concurrency: 1 }), (_req, res) => {
    complete = () => res.json({ data: 'ok' });
    accepted();
  });
  api.use(errorHandler);
  const first = request(api).post('/upload').field('titulo', 'a').then(response => response);
  await ready;
  const busy = await request(api).post('/upload').field('titulo', 'b');
  expect(busy.status).toBe(500);
  expect(busy.body.error.code).toBe('UPLOAD_BUSY');
  complete!();
  expect((await first).status).toBe(200);
});
