import { afterEach, expect, test, vi } from 'vitest';
import { createIngestionService } from '../src/services/ingest-asset.js';
import { CloudStorageError, type CloudAsset, type CloudStorage } from '../src/services/cloud-storage.js';
import type { AssetPersistence } from '../src/services/asset-persistence.js';
import type { UploadJournal } from '../src/services/upload-journal.js';
import type { ValidatedUpload } from '../src/services/validate-upload.js';
import { tinyPng } from './media-fixtures.js';

afterEach(() => vi.restoreAllMocks());
const asset: CloudAsset = { publicId: 'cloud-media-vault/owned', resourceType: 'image', secureUrl: 'https://res.cloudinary.com/test/image/upload/own.png', bytes: 70, format: 'png' };
const input: ValidatedUpload = { buffer: tinyPng(), titulo: 'Prueba', subidoPor: 'David', nombreOriginal: 'foto.png', categoria: 'imagen', resourceType: 'image', mimeType: 'image/png', tamanoBytes: 70 };

function dependencies() {
  const cloud: CloudStorage = {
    upload: vi.fn(async options => { await options.onPrepared?.(asset); return asset; }),
    delete: vi.fn().mockResolvedValue('deleted'),
  };
  const persistence: AssetPersistence = { create: vi.fn(async metadata => ({ ...metadata,
    id: 'c2af51c8-aa31-413a-aeff-81d001a4776d', fechaSubida: new Date(), estado: 'ACTIVO' })) };
  const journal: UploadJournal = { append: vi.fn().mockResolvedValue(undefined) };
  return { cloud, persistence, journal };
}

test('fallo DB elimina la referencia cloud confirmada y registra la compensación', async () => {
  const deps = dependencies();
  vi.mocked(deps.persistence.create).mockRejectedValue(new Error('secret DB URL'));
  await expect(createIngestionService(deps)(input)).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
  expect(deps.cloud.delete).toHaveBeenCalledWith({ publicId: asset.publicId, resourceType: asset.resourceType });
  expect(deps.journal.append).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'COMPENSATED', reasonCode: 'PERSISTENCE_FAILED' }));
});

test('fallo de compensación queda pendiente y los mensajes no contienen secretos', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const deps = dependencies();
  vi.mocked(deps.persistence.create).mockRejectedValue(new Error('secret DB URL'));
  vi.mocked(deps.cloud.delete).mockRejectedValue(new Error('secret cloud key'));
  await expect(createIngestionService(deps)(input)).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
  expect(deps.journal.append).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'RECONCILIATION_REQUIRED' }));
  expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
});

test('timeout después de preparar un recurso no confirma ausencia aunque destroy no lo encuentre', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const deps = dependencies();
  vi.mocked(deps.cloud.upload).mockImplementation(async options => {
    await options.onPrepared?.(asset);
    throw new CloudStorageError('UPLOAD_TIMEOUT', asset);
  });
  vi.mocked(deps.cloud.delete).mockResolvedValue('already_absent');
  await expect(createIngestionService(deps)(input)).rejects.toMatchObject({ code: 'CLOUD_UPLOAD_FAILED' });
  expect(deps.persistence.create).not.toHaveBeenCalled();
  expect(deps.journal.append).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'RECONCILIATION_REQUIRED' }));
});

test('no transfiere ni compensa si el diario falla antes de enviar el binario', async () => {
  const deps = dependencies();
  vi.mocked(deps.journal.append).mockRejectedValue(new Error('disk unavailable'));
  await expect(createIngestionService(deps)(input)).rejects.toMatchObject({ code: 'CLOUD_UPLOAD_FAILED' });
  expect(deps.persistence.create).not.toHaveBeenCalled();
  expect(deps.cloud.delete).not.toHaveBeenCalled();
});

test('desconexión después de cloud compensa y no inicia persistencia', async () => {
  const deps = dependencies();
  const controller = new AbortController();
  vi.mocked(deps.cloud.upload).mockImplementation(async options => {
    await options.onPrepared?.(asset); controller.abort(); return asset;
  });
  await expect(createIngestionService(deps)(input, controller.signal)).rejects.toMatchObject({ code: 'UPLOAD_CANCELLED' });
  expect(deps.cloud.delete).toHaveBeenCalledOnce();
  expect(deps.persistence.create).not.toHaveBeenCalled();
});

test('un fallo tardío del diario no borra un activo que DB confirmó', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const deps = dependencies();
  vi.mocked(deps.journal.append).mockImplementation(async event => { if (event.phase === 'PERSISTED') throw new Error('disk unavailable'); });
  await expect(createIngestionService(deps)(input)).resolves.toMatchObject({ id: expect.any(String) });
  expect(deps.cloud.delete).not.toHaveBeenCalled();
});
