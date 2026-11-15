import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { AssetPersistence, PersistedAsset } from '../services/asset-persistence.js';

export const assetSelect = {
  id: true, titulo: true, nombreOriginal: true, secureUrl: true, publicId: true,
  resourceType: true, categoria: true, mimeType: true, tamanoBytes: true,
  fechaSubida: true, subidoPor: true, estado: true,
} satisfies Prisma.ActivoSelect;

export function createAssetRepository(database: Pick<PrismaClient, 'activo'>): AssetPersistence {
  return {
    async create(metadata): Promise<PersistedAsset> {
      // Lista explícita: ni el buffer ni campos operativos del cliente llegan a Prisma.
      const saved = await database.activo.create({
        data: {
          titulo: metadata.titulo, nombreOriginal: metadata.nombreOriginal,
          secureUrl: metadata.secureUrl, publicId: metadata.publicId,
          resourceType: metadata.resourceType, categoria: metadata.categoria,
          mimeType: metadata.mimeType, tamanoBytes: metadata.tamanoBytes,
          subidoPor: metadata.subidoPor, estado: 'ACTIVO',
        },
        select: assetSelect,
      });
      if (saved.estado !== 'ACTIVO') throw new Error('La persistencia no confirmó el estado activo.');
      return { ...saved, estado: 'ACTIVO' };
    },
  };
}
