import { expect, test, vi } from 'vitest';
import { createDeletionRepository } from '../src/adapters/deletion-repository.js';
import { createDeleteAsset } from '../src/services/delete-asset.js';
import { reconcileUpload } from '../src/services/reconcile-upload.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

const now = new Date('2026-11-15T12:00:00Z');
const old = new Date(now.getTime() - 600_000);
const base = { id: 'e357770a-5ede-40c7-9098-3b1b18d05dbc', publicId: 'cloud-media-vault/recovery', resourceType: 'image', intentosBorrado: 2, borradoIniciadoEn: old };
function databaseFor(estado: string, started = old, count = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  const activo = { findUnique: vi.fn().mockResolvedValue({ ...base, estado, borradoIniciadoEn: started }), updateMany,
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const database = { activo, $transaction: async (work: (tx: unknown) => unknown) => work({ activo }) } as unknown as PrismaClient;
  return { store: createDeletionRepository(database, () => now), activo };
}

test.each(['ELIMINANDO', 'NUBE_ELIMINADA'])('no roba una reserva vigente en %s', async estado => {
  const { store, activo } = databaseFor(estado, now);
  await expect(store.claim(base.id)).resolves.toBe('busy');
  expect(activo.updateMany).not.toHaveBeenCalled();
});

test.each(['ERROR_BORRADO', 'ELIMINANDO', 'NUBE_ELIMINADA'])('recupera %s con nuevo intento y condición de versión', async estado => {
  const { store, activo } = databaseFor(estado);
  await expect(store.claim(base.id)).resolves.toMatchObject({ attempt: 3, cloudRemoved: estado === 'NUBE_ELIMINADA' });
  expect(activo.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
    id: base.id, estado, intentosBorrado: 2, borradoIniciadoEn: old,
  } }));
});

test('un competidor que ya reservó el activo impide duplicar la operación', async () => {
  await expect(databaseFor('ACTIVO', old, 0).store.claim(base.id)).resolves.toBe('busy');
});

test('NUBE_ELIMINADA recuperada finaliza DB sin repetir llamada cloud', async () => {
  const { store, activo } = databaseFor('NUBE_ELIMINADA');
  const cloud = { delete: vi.fn().mockResolvedValue('deleted' as const) };
  await createDeleteAsset(store, cloud)(base.id);
  expect(cloud.delete).not.toHaveBeenCalled();
  expect(activo.deleteMany).toHaveBeenCalledWith({ where: { id: base.id, estado: 'NUBE_ELIMINADA', intentosBorrado: 3 } });
});

test('recurso ya ausente permite finalizar un borrado interrumpido', async () => {
  const { store, activo } = databaseFor('ELIMINANDO');
  const cloud = { delete: vi.fn().mockResolvedValue('already_absent' as const) };
  await createDeleteAsset(store, cloud)(base.id);
  expect(activo.deleteMany).toHaveBeenCalledOnce();
});

const event = { operationId: '05da303e-7e3b-40c4-b29f-e7f28104136b', publicId: base.publicId,
  resourceType: 'image' as const, phase: 'RECONCILIATION_REQUIRED' as const, recordedAt: old.toISOString() };
function recovery() {
  return { lookup: { find: vi.fn().mockResolvedValue(null) }, cloud: { delete: vi.fn().mockResolvedValue('already_absent' as const) },
    journal: { append: vi.fn().mockResolvedValue(undefined) } };
}

test('reconciliación conserva un recurso que DB confirmó antes de perder respuesta', async () => {
  const deps = recovery();
  deps.lookup.find.mockResolvedValue({ id: base.id });
  expect(await reconcileUpload(event, deps, now)).toBe('persisted');
  expect(deps.cloud.delete).not.toHaveBeenCalled();
  expect(deps.journal.append).toHaveBeenCalledWith(expect.objectContaining({ phase: 'PERSISTED', recordId: base.id }));
});

test('reconciliación borra solo después de confirmar ausencia DB', async () => {
  const deps = recovery();
  expect(await reconcileUpload(event, deps, now)).toBe('compensated');
  expect(deps.lookup.find.mock.invocationCallOrder[0]).toBeLessThan(deps.cloud.delete.mock.invocationCallOrder[0]);
});

test('DB caída impide compensación durante reconciliación', async () => {
  const deps = recovery();
  deps.lookup.find.mockRejectedValue(new Error('DB offline'));
  await expect(reconcileUpload(event, deps, now)).rejects.toThrow();
  expect(deps.cloud.delete).not.toHaveBeenCalled();
});

test('no reconcilia una subida reciente ni repite una operación resuelta', async () => {
  const deps = recovery();
  expect(await reconcileUpload({ ...event, recordedAt: now.toISOString() }, deps, now)).toBe('recent');
  expect(await reconcileUpload({ ...event, phase: 'COMPENSATED' }, deps, now)).toBe('resolved');
  expect(deps.lookup.find).not.toHaveBeenCalled();
  expect(deps.cloud.delete).not.toHaveBeenCalled();
});
