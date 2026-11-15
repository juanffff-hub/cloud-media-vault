import { afterEach, expect, test, vi } from 'vitest';
import request from 'supertest';
import { createDeleteAsset, type AssetDeletionStore } from '../src/services/delete-asset.js';
import { createApp } from '../src/app.js';
import { healthyProbe } from './fixtures.js';

afterEach(() => vi.restoreAllMocks());
const ticket = { id: '83a5f72d-5b33-412c-a730-e2fe83320521', publicId: 'cloud-media-vault/stored', resourceType: 'video' as const, attempt: 1 };
function setup() {
  const store: AssetDeletionStore = { claim: vi.fn().mockResolvedValue(ticket),
    markCloudRemoved: vi.fn().mockResolvedValue(undefined), markCloudError: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined) };
  const cloud = { delete: vi.fn().mockResolvedValue('deleted' as const) };
  const remove = createDeleteAsset(store, cloud);
  return { store, cloud, remove, app: createApp({ CLIENT_ORIGIN: 'http://127.0.0.1:5173' }, healthyProbe, { remove }) };
}

test('DELETE confirma cloud con la referencia DB antes de eliminar metadatos', async () => {
  const { app, store, cloud } = setup();
  const response = await request(app).delete(`/api/archivos/${ticket.id}`);
  expect(response.status).toBe(204);
  expect(response.text).toBe('');
  expect(cloud.delete).toHaveBeenCalledWith({ publicId: ticket.publicId, resourceType: 'video' });
  expect(cloud.delete.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(store.markCloudRemoved).mock.invocationCallOrder[0]);
  expect(vi.mocked(store.markCloudRemoved).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(store.remove).mock.invocationCallOrder[0]);
});

test('fallo cloud conserva la fila DB y registra el fallo sin revelar secretos', async () => {
  const { app, store, cloud } = setup();
  cloud.delete.mockRejectedValue(new Error('secret cloud details'));
  const response = await request(app).delete(`/api/archivos/${ticket.id}`);
  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe('CLOUD_DELETE_FAILED');
  expect(store.markCloudError).toHaveBeenCalledWith(ticket);
  expect(store.remove).not.toHaveBeenCalled();
  expect(response.text).not.toContain('secret');
});

test.each(['markCloudRemoved', 'remove'] as const)('fallo DB en %s deja un error recuperable', async method => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { remove, store } = setup();
  vi.mocked(store[method]).mockRejectedValue(new Error('secret DB details'));
  await expect(remove(ticket.id)).rejects.toMatchObject({ status: 500, code: 'DELETE_PENDING' });
  if (method === 'markCloudRemoved') expect(store.remove).not.toHaveBeenCalled();
});

test.each([['missing', 404, 'ASSET_NOT_FOUND'], ['busy', 500, 'DELETE_IN_PROGRESS']] as const)
('la reserva %s impide tocar cloud', async (claim, status, code) => {
  const { remove, store, cloud } = setup();
  vi.mocked(store.claim).mockResolvedValue(claim);
  await expect(remove(ticket.id)).rejects.toMatchObject({ status, code });
  expect(cloud.delete).not.toHaveBeenCalled();
});

test('DELETE rechaza IDs inválidos y referencias cloud enviadas por el cliente', async () => {
  const { app, cloud, store } = setup();
  expect((await request(app).delete('/api/archivos/no-es-uuid')).status).toBe(400);
  expect((await request(app).delete(`/api/archivos/${ticket.id}`).send({ publicId: 'otro' })).status).toBe(400);
  expect((await request(app).delete(`/api/archivos/${ticket.id}?publicId=otro`)).status).toBe(400);
  expect(store.claim).not.toHaveBeenCalled();
  expect(cloud.delete).not.toHaveBeenCalled();
});
