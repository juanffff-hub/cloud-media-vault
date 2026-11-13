import request from 'supertest';
import { expect, test } from 'vitest';
import { createApp } from '../src/app.js';

test('la API inicia y responde JSON sin exponer el framework', async () => {
  const response = await request(createApp()).get('/api');
  expect(response.status).toBe(200);
  expect(response.body.data.nombre).toBe('Cloud Media Vault');
  expect(response.headers['x-powered-by']).toBeUndefined();
});

test('las rutas todavía no implementadas responden 404 JSON', async () => {
  const response = await request(createApp()).post('/api/archivos');
  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe('NOT_FOUND');
});
