import { Writable } from 'node:stream';
import { afterEach, expect, test, vi } from 'vitest';
import { createCloudinaryStorage, type CloudinaryGateway } from '../src/adapters/cloudinary.js';
import { readEnvironment } from '../src/config/env.js';
import { validEnvironment } from './fixtures.js';

afterEach(() => vi.useRealTimers());
const config = readEnvironment(validEnvironment);

function hangingGateway() {
  const stream = new Writable({ write(_chunk, _encoding, done) { done(); } });
  return { stream, gateway: {
    uploadStream: vi.fn(() => stream),
    destroy: vi.fn(() => new Promise<{ result: string }>(() => {})),
  } satisfies CloudinaryGateway };
}

test('el timeout absoluto rechaza y destruye el stream aunque el SDK no responda', async () => {
  vi.useFakeTimers();
  const { stream, gateway } = hangingGateway();
  const pending = createCloudinaryStorage(config, gateway).upload({ buffer: Buffer.from('fixture'), category: 'imagen' });
  const checked = expect(pending).rejects.toMatchObject({ code: 'UPLOAD_TIMEOUT', candidate: { resourceType: 'image' } });
  await vi.advanceTimersByTimeAsync(config.CLOUDINARY_TIMEOUT_MS);
  await checked;
  expect(stream.destroyed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

test('cancelar el cliente aborta la operación y conserva su referencia candidata', async () => {
  const { stream, gateway } = hangingGateway();
  const controller = new AbortController();
  const pending = createCloudinaryStorage(config, gateway).upload({ buffer: Buffer.from('fixture'), category: 'video', signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'UPLOAD_CANCELLED', candidate: { resourceType: 'video' } });
  expect(stream.destroyed).toBe(true);
});

test('si ya estaba cancelada no se crea una solicitud al proveedor', async () => {
  const { gateway } = hangingGateway();
  await expect(createCloudinaryStorage(config, gateway).upload({ buffer: Buffer.from('fixture'), category: 'pdf', signal: AbortSignal.abort() }))
    .rejects.toMatchObject({ code: 'UPLOAD_CANCELLED' });
  expect(gateway.uploadStream).not.toHaveBeenCalled();
});

test('registra la referencia antes de iniciar transferencia y falla cerrado si no puede registrarla', async () => {
  const { gateway } = hangingGateway();
  const prepared = vi.fn(async () => {
    expect(gateway.uploadStream).not.toHaveBeenCalled();
    throw new Error('Registro no disponible');
  });
  await expect(createCloudinaryStorage(config, gateway).upload({ buffer: Buffer.from('fixture'), category: 'pdf', onPrepared: prepared })).rejects.toThrow();
  expect(prepared).toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'image', publicId: expect.stringMatching(/^cloud-media-vault\//) }));
  expect(gateway.uploadStream).not.toHaveBeenCalled();
});

test('también limita el tiempo de una compensación de borrado', async () => {
  vi.useFakeTimers();
  const { gateway } = hangingGateway();
  const pending = createCloudinaryStorage(config, gateway).delete({ publicId: 'cloud-media-vault/own', resourceType: 'image' });
  const checked = expect(pending).rejects.toMatchObject({ code: 'DELETE_FAILED' });
  await vi.advanceTimersByTimeAsync(config.CLOUDINARY_TIMEOUT_MS);
  await checked;
  expect(vi.getTimerCount()).toBe(0);
});
