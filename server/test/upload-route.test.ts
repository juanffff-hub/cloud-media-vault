import express from 'express';
import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { createUploadRouter } from '../src/routes/upload.js';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errors.js';
import type { CloudStorage, CloudAsset } from '../src/services/cloud-storage.js';
import type { AssetPersistence } from '../src/services/asset-persistence.js';
import type { UploadJournal } from '../src/services/upload-journal.js';
import { tinyPng } from './media-fixtures.js';
import { healthyProbe } from './fixtures.js';

export function uploadTestDependencies() {
  const asset: CloudAsset = { publicId: 'cloud-media-vault/test-own-id', resourceType: 'image',
    secureUrl: 'https://res.cloudinary.com/test/image/upload/test.png', bytes: tinyPng().length, format: 'png' };
  const cloud: CloudStorage = {
    upload: vi.fn(async input => { await input.onPrepared?.(asset); return asset; }),
    delete: vi.fn().mockResolvedValue('deleted'),
  };
  const persistence: AssetPersistence = { create: vi.fn(async data => ({
    ...data, id: '2c277e48-c6b9-45de-a7fe-9734ff6576a3', fechaSubida: new Date('2026-11-13T12:00:00Z'), estado: 'ACTIVO',
  })) };
  const journal: UploadJournal = { append: vi.fn().mockResolvedValue(undefined) };
  return { cloud, persistence, journal };
}

function testApp(dependencies = uploadTestDependencies()) {
  const app = express();
  app.use('/api/archivos', createUploadRouter(dependencies));
  app.use(errorHandler);
  return { app, ...dependencies };
}

test('la ruta preparada confirma 201 solo después de cloud y persistencia', async () => {
  const { app, cloud, persistence } = testApp();
  const response = await request(app).post('/api/archivos').field('titulo', 'Imagen').field('subidoPor', 'David')
    .attach('archivo', tinyPng(), { filename: 'foto.png', contentType: 'image/png' });
  expect(response.status).toBe(201);
  expect(response.body.data).toMatchObject({ titulo: 'Imagen', subidoPor: 'David', id: expect.any(String) });
  expect(cloud.upload).toHaveBeenCalledOnce();
  expect(persistence.create).toHaveBeenCalledOnce();
  expect(vi.mocked(persistence.create).mock.calls[0][0]).not.toHaveProperty('buffer');
  expect(vi.mocked(cloud.upload).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(persistence.create).mock.invocationCallOrder[0]);
});

test('un fallo cloud no llama a persistencia y no filtra el mensaje del proveedor', async () => {
  const dependencies = uploadTestDependencies();
  vi.mocked(dependencies.cloud.upload).mockRejectedValue(new Error('provider-secret'));
  const { app, persistence } = testApp(dependencies);
  const response = await request(app).post('/api/archivos').field('titulo', 'Imagen').field('subidoPor', 'David').attach('archivo', tinyPng(), 'foto.png');
  expect(response.status).toBe(500);
  expect(persistence.create).not.toHaveBeenCalled();
  expect(response.text).not.toContain('provider-secret');
});

test('un fallo de persistencia nunca responde 201', async () => {
  const dependencies = uploadTestDependencies();
  vi.mocked(dependencies.persistence.create).mockRejectedValue(new Error('database-secret'));
  const response = await request(testApp(dependencies).app).post('/api/archivos')
    .field('titulo', 'Imagen').field('subidoPor', 'David').attach('archivo', tinyPng(), 'foto.png');
  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe('PERSISTENCE_FAILED');
  expect(response.text).not.toContain('database-secret');
});

test('formulario o MIME inválido produce 400 antes de cloud', async () => {
  const { app, cloud } = testApp();
  expect((await request(app).post('/api/archivos').field('titulo', 'Imagen').attach('archivo', tinyPng(), 'foto.png')).status).toBe(400);
  expect((await request(app).post('/api/archivos').field('titulo', 'Imagen').field('subidoPor', 'David')
    .attach('archivo', tinyPng(), { filename: 'foto.png', contentType: 'text/plain' })).status).toBe(400);
  expect(cloud.upload).not.toHaveBeenCalled();
});

test('la aplicación pública mantiene POST sin registrar hasta Parte 3', async () => {
  const app = createApp({ CLIENT_ORIGIN: 'http://127.0.0.1:5173' }, healthyProbe);
  expect((await request(app).post('/api/archivos')).status).toBe(404);
});

test('la fábrica de la ruta no admite una persistencia ausente', () => {
  expect(() => createUploadRouter({ ...uploadTestDependencies(), persistence: undefined! })).toThrow('persistencia conectada');
});
