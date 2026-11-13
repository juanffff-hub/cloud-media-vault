import express from 'express';
import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { Writable } from 'node:stream';
import { createCloudinaryStorage, type CloudinaryGateway } from '../src/adapters/cloudinary.js';
import { readEnvironment } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errors.js';
import { validEnvironment } from './fixtures.js';

test('un error desconocido devuelve 500 sin mensaje interno ni stack', async () => {
  const app = express();
  app.get('/failure', () => { throw new Error('secret-database-url'); });
  app.use(errorHandler);
  const response = await request(app).get('/failure');
  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe('INTERNAL_ERROR');
  expect(response.text).not.toMatch(/secret|stack|Error:/);
});

test.each(['callback', 'stream', 'throw'])('error de subida por %s conserva solo referencia segura para reconciliar', async (failure) => {
  const gateway: CloudinaryGateway = {
    uploadStream: (_options, callback) => {
      if (failure === 'throw') throw new Error('provider-secret');
      return new Writable({ write(_chunk, _encoding, done) {
        if (failure === 'callback') {
          callback({ message: 'provider-secret', name: 'NetworkError', http_code: 500 });
          done();
        } else { done(new Error('provider-secret')); }
      } });
    },
    destroy: vi.fn(),
  };
  const pending = createCloudinaryStorage(readEnvironment(validEnvironment), gateway)
    .upload({ buffer: Buffer.from('fixture'), category: 'pdf' });
  await expect(pending).rejects.toMatchObject({
    code: 'UPLOAD_FAILED',
    candidate: { publicId: expect.stringMatching(/^cloud-media-vault\//), resourceType: 'image' },
  });
  await expect(pending).rejects.not.toThrow('provider-secret');
});

test('fallo de red al borrar no confirma éxito ni expone secretos', async () => {
  const gateway: CloudinaryGateway = {
    uploadStream: vi.fn(),
    destroy: vi.fn().mockRejectedValue(new Error('provider-secret')),
  };
  const pending = createCloudinaryStorage(readEnvironment(validEnvironment), gateway)
    .delete({ publicId: 'cloud-media-vault/test', resourceType: 'video' });
  await expect(pending).rejects.toMatchObject({ code: 'DELETE_FAILED' });
  await expect(pending).rejects.not.toThrow('provider-secret');
});
