import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { AssetPersistence, PersistedAsset } from '../services/asset-persistence.js';
import type { AssetListing } from '../services/list-assets.js';

export const assetSelect = {
  id: true, titulo: true, nombreOriginal: true, secureUrl: true, publicId: true,
  resourceType: true, categoria: true, mimeType: true, tamanoBytes: true,
  fechaSubida: true, subidoPor: true, estado: true,
} satisfies Prisma.ActivoSelect;

export function createAssetRepository(database: Pick<PrismaClient, 'activo' | '$transaction'>): AssetPersistence & AssetListing {
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
    async list(query) {
      // LIKE trata % y _ como patrones: escaparlos para buscar texto literal.
      const where: Prisma.ActivoWhereInput = { estado: 'ACTIVO', categoria: query.categoria,
        ...(query.buscar ? { titulo: { contains: query.buscar.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' } } : {}) };
      return database.$transaction(async tx => {
        const rows = await tx.activo.findMany({ where, select: assetSelect,
          orderBy: [{ fechaSubida: 'desc' }, { id: 'desc' }],
          skip: (query.pagina - 1) * query.limite, take: query.limite });
        const total = await tx.activo.count({ where });
        return { data: rows.map(row => ({ ...row, estado: 'ACTIVO' as const })),
          meta: { pagina: query.pagina, limite: query.limite, total, totalPaginas: Math.ceil(total / query.limite) } };
      }, { isolationLevel: 'RepeatableRead' });
    },
  };
}
