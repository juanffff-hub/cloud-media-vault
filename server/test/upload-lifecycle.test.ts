import express from 'express';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import request from 'supertest';
import { expect, test } from 'vitest';
import { createMultipartUpload } from '../src/middleware/multipart.js';
import { errorHandler } from '../src/middleware/errors.js';

test('el buffer se libera después de una respuesta correcta', async () => {
  const app = express();
  let file: Express.Multer.File | undefined;
  app.post('/upload', createMultipartUpload(), (req, res) => { file = req.file; res.json({ data: 'ok' }); });
  app.use(errorHandler);
  expect((await request(app).post('/upload').attach('archivo', Buffer.from('fixture'), 'file.png')).status).toBe(200);
  expect(file?.buffer.length).toBe(0);
});

test('un multipart lento se cancela y devuelve el cupo de recepción', async () => {
  const app = express();
  app.post('/upload', createMultipartUpload({ concurrency: 1, timeoutMs: 100 }), (_req, res) => res.json({ data: 'ok' }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server unavailable');
  try {
    await new Promise<void>((resolve, reject) => {
      const slow = httpRequest({ host: '127.0.0.1', port: address.port, path: '/upload', method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=slow', 'Transfer-Encoding': 'chunked' } });
      const guard = setTimeout(() => { slow.destroy(); reject(new Error('La recepción no se canceló.')); }, 2000);
      slow.once('error', () => { clearTimeout(guard); resolve(); });
      slow.write('--slow\r\nContent-Disposition: form-data; name="archivo"; filename="a.png"\r\nContent-Type: image/png\r\n\r\npartial');
    });
    expect((await request(server).post('/upload').field('titulo', 'otro')).status).toBe(200);
  } finally { server.close(); await once(server, 'close'); }
});
