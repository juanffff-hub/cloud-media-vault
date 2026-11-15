import type { PrismaClient } from '../generated/prisma/client.js';
import type { AssetDeletionStore } from '../services/delete-asset.js';

export function createDeletionRepository(database: Pick<PrismaClient, '$transaction' | 'activo'>): AssetDeletionStore {
  return {
    async claim(id) {
      return database.$transaction(async tx => {
        const row = await tx.activo.findUnique({ where: { id } });
        if (!row) return 'missing';
        if (row.estado !== 'ACTIVO') return 'busy';
        const updated = await tx.activo.updateMany({
          where: { id, estado: 'ACTIVO', intentosBorrado: row.intentosBorrado },
          data: { estado: 'ELIMINANDO', intentosBorrado: { increment: 1 }, borradoIniciadoEn: new Date(), ultimoErrorCodigo: null },
        });
        if (updated.count !== 1) return 'busy';
        return { id, publicId: row.publicId, resourceType: row.resourceType, attempt: row.intentosBorrado + 1 };
      });
    },
    async markCloudRemoved(ticket) {
      const result = await database.activo.updateMany({
        where: { id: ticket.id, estado: 'ELIMINANDO', intentosBorrado: ticket.attempt },
        data: { estado: 'NUBE_ELIMINADA', ultimoErrorCodigo: null },
      });
      if (result.count !== 1) throw new Error('Se perdió la reserva de borrado.');
    },
    async markCloudError(ticket) {
      const result = await database.activo.updateMany({
        where: { id: ticket.id, estado: 'ELIMINANDO', intentosBorrado: ticket.attempt },
        data: { estado: 'ERROR_BORRADO', ultimoErrorCodigo: 'CLOUD_DELETE_FAILED' },
      });
      if (result.count !== 1) throw new Error('Se perdió la reserva de borrado.');
    },
    async remove(ticket) {
      const result = await database.activo.deleteMany({
        where: { id: ticket.id, estado: 'NUBE_ELIMINADA', intentosBorrado: ticket.attempt },
      });
      if (result.count !== 1) throw new Error('No se confirmó el borrado de metadatos.');
    },
  };
}
