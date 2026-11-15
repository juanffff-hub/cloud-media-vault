import { HttpError } from '../middleware/errors.js';
import type { CloudReference, CloudStorage } from './cloud-storage.js';

export interface DeletionTicket extends CloudReference { id: string; attempt: number }
export interface AssetDeletionStore {
  claim(id: string): Promise<DeletionTicket | 'missing' | 'busy'>;
  markCloudRemoved(ticket: DeletionTicket): Promise<void>;
  markCloudError(ticket: DeletionTicket): Promise<void>;
  remove(ticket: DeletionTicket): Promise<void>;
}
export type DeleteAsset = (id: string) => Promise<void>;

export function createDeleteAsset(store: AssetDeletionStore, cloud: Pick<CloudStorage, 'delete'>): DeleteAsset {
  return async id => {
    const ticket = await store.claim(id);
    if (ticket === 'missing') throw new HttpError(404, 'ASSET_NOT_FOUND', 'El archivo no existe.');
    if (ticket === 'busy') throw new HttpError(500, 'DELETE_IN_PROGRESS', 'El borrado sigue en curso. Inténtalo de nuevo en unos minutos.');
    const report = (phase: string) => console.error(JSON.stringify({ event: 'DELETE_RETRY_REQUIRED', id, attempt: ticket.attempt, phase }));
    try {
      const result = await cloud.delete({ publicId: ticket.publicId, resourceType: ticket.resourceType });
      if (result !== 'deleted' && result !== 'already_absent') throw new Error('Cloud deletion not confirmed');
    } catch {
      try { await store.markCloudError(ticket); } catch { report('CLOUD_ERROR_NOT_RECORDED'); }
      throw new HttpError(500, 'CLOUD_DELETE_FAILED', 'No se pudo confirmar el borrado en la nube. Puedes reintentarlo.');
    }
    try {
      await store.markCloudRemoved(ticket);
      await store.remove(ticket);
    } catch {
      report('DATABASE_FINALIZATION');
      throw new HttpError(500, 'DELETE_PENDING', 'El archivo ya no está en la nube; falta completar su eliminación. Puedes reintentarlo.');
    }
  };
}
