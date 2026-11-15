import { expect, test, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createAssetRepository } from '../src/adapters/asset-repository.js';
import type { AssetMetadata } from '../src/services/asset-persistence.js';
import { PersistenceUncertainError } from '../src/services/asset-persistence.js';

const metadata: AssetMetadata = { titulo: 'Documento', nombreOriginal: 'documento.pdf',
  secureUrl: 'https://res.cloudinary.com/test/image/upload/own.pdf', publicId: 'cloud-media-vault/own',
  resourceType: 'image', categoria: 'pdf', mimeType: 'application/pdf', tamanoBytes: 600, subidoPor: 'Sebastian' };

test('Prisma recibe solo metadatos y devuelve el registro confirmado', async () => {
  const create = vi.fn(async () => ({ ...metadata, id: 'db-id', fechaSubida: new Date(), estado: 'ACTIVO' }));
  const database = { activo: { create } } as unknown as PrismaClient;
  const input = { ...metadata, buffer: Buffer.from('private binary'), estado: 'NUBE_ELIMINADA' };
  const saved = await createAssetRepository(database).create(input);
  expect(saved).toMatchObject({ ...metadata, id: 'db-id', estado: 'ACTIVO' });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: { ...metadata, estado: 'ACTIVO' } }));
  expect(JSON.stringify(create.mock.calls)).not.toContain('buffer');
});

test('el rechazo de Prisma se propaga al servicio para compensación', async () => {
  const create = vi.fn().mockRejectedValue(Object.assign(new Error('database failure'), { code: 'P2004' }));
  const database = { activo: { create } } as unknown as PrismaClient;
  await expect(createAssetRepository(database).create(metadata)).rejects.toThrow('database failure');
});

test('una escritura de resultado incierto conserva cloud hasta reconciliar', async () => {
  const database = { activo: { create: vi.fn().mockRejectedValue(new Error('connection lost')),
    findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
  await expect(createAssetRepository(database).create(metadata)).rejects.toBeInstanceOf(PersistenceUncertainError);
});

test('una escritura confirmada por consulta posterior no provoca compensación', async () => {
  const row = { ...metadata, id: 'db-id', fechaSubida: new Date(), estado: 'ACTIVO' };
  const database = { activo: { create: vi.fn().mockRejectedValue(new Error('reply lost')),
    findUnique: vi.fn().mockResolvedValue(row) } } as unknown as PrismaClient;
  await expect(createAssetRepository(database).create(metadata)).resolves.toEqual(row);
});
