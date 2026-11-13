import { Writable } from 'node:stream';
import type { UploadApiResponse } from 'cloudinary';
import { expect, test, vi } from 'vitest';
import { createCloudinaryStorage, type CloudinaryGateway } from '../src/adapters/cloudinary.js';
import { readEnvironment } from '../src/config/env.js';
import { validEnvironment } from './fixtures.js';

const config = readEnvironment(validEnvironment);

function gatewayWithResponse(overrides: Partial<UploadApiResponse> = {}) {
  const gateway: CloudinaryGateway = {
    uploadStream: vi.fn((options, callback) => new Writable({
      write(_chunk, _encoding, done) { done(); },
      final(done) {
        callback(undefined, {
          secure_url: 'https://res.cloudinary.com/unit-tests/image/upload/test.png',
          public_id: options.public_id,
          resource_type: options.resource_type,
          bytes: 8,
          format: options.allowed_formats?.[0],
          ...overrides,
        } as UploadApiResponse);
        done();
      },
    })),
    destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
  };
  return gateway;
}

test.each([
  ['imagen', 'image'], ['video', 'video'], ['pdf', 'image'],
] as const)('envía %s con resource_type %s y conserva los metadatos devueltos', async (category, resourceType) => {
  const gateway = gatewayWithResponse();
  const asset = await createCloudinaryStorage(config, gateway).upload({ buffer: Buffer.from('fixture'), category });
  expect(asset.resourceType).toBe(resourceType);
  expect(asset.secureUrl).toBe('https://res.cloudinary.com/unit-tests/image/upload/test.png');
  expect(asset.publicId).toMatch(/^cloud-media-vault\/[0-9a-f-]{36}$/);
  expect(gateway.uploadStream).toHaveBeenCalledWith(expect.objectContaining({
    resource_type: resourceType, overwrite: false, use_filename: false, timeout: 30_000,
  }), expect.any(Function));
  expect(asset).not.toHaveProperty('api_secret');
});

test('cada subida recibe un identificador independiente del nombre del archivo', async () => {
  const storage = createCloudinaryStorage(config, gatewayWithResponse());
  const input = { buffer: Buffer.from('fixture'), category: 'imagen' as const };
  expect((await storage.upload(input)).publicId).not.toBe((await storage.upload(input)).publicId);
});

test.each([{ secure_url: 'http://unsafe.test/a' }, { resource_type: 'raw' }, { bytes: 0 }, { format: 'exe' }] as const)('rechaza metadatos cloud inválidos', async (result) => {
  await expect(createCloudinaryStorage(config, gatewayWithResponse(result)).upload({
    buffer: Buffer.from('fixture'), category: 'imagen',
  })).rejects.toMatchObject({ code: 'INVALID_CLOUD_RESPONSE' });
});

test.each([0, 10_485_761])('rechaza buffer de %s bytes antes de llamar al proveedor', async (length) => {
  const gateway = gatewayWithResponse();
  await expect(createCloudinaryStorage(config, gateway).upload({ buffer: Buffer.alloc(length), category: 'pdf' }))
    .rejects.toMatchObject({ code: 'INVALID_UPLOAD' });
  expect(gateway.uploadStream).not.toHaveBeenCalled();
});

test('borrar usa publicId y resourceType persistidos e invalida caché', async () => {
  const gateway = gatewayWithResponse();
  const reference = { publicId: 'cloud-media-vault/unit-id', resourceType: 'video' as const };
  await expect(createCloudinaryStorage(config, gateway).delete(reference)).resolves.toBe('deleted');
  expect(gateway.destroy).toHaveBeenCalledWith(reference.publicId, expect.objectContaining({ resource_type: 'video', invalidate: true }));
});

test('recurso ya ausente es un resultado idempotente explícito', async () => {
  const gateway = gatewayWithResponse();
  vi.mocked(gateway.destroy).mockResolvedValue({ result: 'not found' });
  await expect(createCloudinaryStorage(config, gateway).delete({ publicId: 'cloud-media-vault/unit-id', resourceType: 'image' }))
    .resolves.toBe('already_absent');
});

test('no acepta borrar identificadores fuera del proyecto', async () => {
  const gateway = gatewayWithResponse();
  await expect(createCloudinaryStorage(config, gateway).delete({ publicId: 'otro-proyecto/item', resourceType: 'image' }))
    .rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
  expect(gateway.destroy).not.toHaveBeenCalled();
});

test('respuesta de borrado ambigua no cuenta como éxito', async () => {
  const gateway = gatewayWithResponse();
  vi.mocked(gateway.destroy).mockResolvedValue({ result: 'pending' });
  await expect(createCloudinaryStorage(config, gateway).delete({ publicId: 'cloud-media-vault/unit-id', resourceType: 'image' }))
    .rejects.toMatchObject({ code: 'DELETE_FAILED' });
});
