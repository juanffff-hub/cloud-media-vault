import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createHealthCheck } from '../src/services/health.js';

const config = { CLIENT_ORIGIN: 'http://127.0.0.1:5173' };

test('health consulta DB y responde 200 sin datos internos y sin caché', async () => {
  const database = vi.fn().mockResolvedValue(undefined);
  const response = await request(createApp(config, createHealthCheck(database)))
    .get('/api/health').set('Origin', config.CLIENT_ORIGIN);
  expect(database).toHaveBeenCalledOnce();
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: { status: 'ok', database: 'up' } });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['access-control-allow-origin']).toBe(config.CLIENT_ORIGIN);
});

test('health falla con 500 y no revela URL ni traza del proveedor', async () => {
  const probe = vi.fn().mockRejectedValue(new Error('postgresql://user:secret@private/db'));
  const response = await request(createApp(config, createHealthCheck(probe))).get('/api/health');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: {
    code: 'DATABASE_UNAVAILABLE', message: 'La base de datos no está disponible.',
  } });
  expect(JSON.stringify(response.body)).not.toMatch(/secret|postgres|stack/i);
});

test('health vuelve a comprobar DB después de un fallo temporal', async () => {
  const probe = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(undefined);
  const app = createApp(config, createHealthCheck(probe));
  expect((await request(app).get('/api/health')).status).toBe(500);
  expect((await request(app).get('/api/health')).status).toBe(200);
  expect(probe).toHaveBeenCalledTimes(2);
});
