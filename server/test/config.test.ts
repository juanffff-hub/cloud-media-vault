import request from 'supertest';
import { expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { readEnvironment } from '../src/config/env.js';
import { validEnvironment } from './fixtures.js';

test('entorno válido: límite fijo de 10 MiB y configuración inmutable', () => {
  const config = readEnvironment(validEnvironment);
  expect(config.MAX_FILE_SIZE_BYTES).toBe(10_485_760);
  expect(Object.isFrozen(config)).toBe(true);
});

test.each(['DATABASE_URL', 'DIRECT_URL', 'CLIENT_ORIGIN', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'])('rechaza %s ausente', (field) => {
  expect(() => readEnvironment({ ...validEnvironment, [field]: '' })).toThrow(field);
});

test.each([
  ['PORT', '3001abc'], ['PORT', '0'], ['NODE_ENV', 'unknown'],
  ['MAX_FILE_SIZE_MB', '11'], ['CLIENT_ORIGIN', '*'],
  ['CLIENT_ORIGIN', 'https://example.test/path'],
  ['CLOUDINARY_FOLDER', 'otro-proyecto'], ['CLOUDINARY_TIMEOUT_MS', '0'],
])('rechaza %s mal formado', (field, value) => {
  expect(() => readEnvironment({ ...validEnvironment, [field]: value })).toThrow(field);
});

test('un error de configuración nunca imprime el valor secreto', () => {
  const secret = 'https://user:private-password@example.test/db';
  expect(() => readEnvironment({ ...validEnvironment, DATABASE_URL: secret })).toThrow('DATABASE_URL');
  try { readEnvironment({ ...validEnvironment, DATABASE_URL: secret }); }
  catch (error) { expect(String(error)).not.toContain('private-password'); }
});

test('CORS permite el origen configurado y preflight DELETE', async () => {
  const app = createApp(readEnvironment(validEnvironment));
  const response = await request(app).options('/api/archivos/id')
    .set('Origin', validEnvironment.CLIENT_ORIGIN).set('Access-Control-Request-Method', 'DELETE');
  expect(response.status).toBe(204);
  expect(response.headers['access-control-allow-origin']).toBe(validEnvironment.CLIENT_ORIGIN);
  expect(response.headers['access-control-allow-methods']).toContain('DELETE');
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
});

test('CORS rechaza otros orígenes sin reflejarlos ni exponer detalles', async () => {
  const response = await request(createApp(readEnvironment(validEnvironment)))
    .get('/api').set('Origin', 'https://untrusted.test');
  expect(response.status).toBe(400);
  expect(response.headers['access-control-allow-origin']).toBeUndefined();
  expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
});

test('JSON mal formado produce 400 sin reflejar el cuerpo', async () => {
  const response = await request(createApp(readEnvironment(validEnvironment)))
    .post('/api/archivos').set('Content-Type', 'application/json').send('{"private":');
  expect(response.status).toBe(400);
  expect(JSON.stringify(response.body)).not.toContain('private');
});
