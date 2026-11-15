import type { CloudReference, CloudStorage } from './cloud-storage.js';
import type { UploadEvent, UploadJournal } from './upload-journal.js';

export const RECONCILIATION_DELAY_MS = 10 * 60 * 1000;
export interface UploadLookup { find(reference: CloudReference): Promise<{ id: string } | null> }

// Operación de mantenimiento: detener la ingesta antes de ejecutarla.
export async function reconcileUpload(event: UploadEvent & { recordedAt: string }, dependencies: {
  lookup: UploadLookup; cloud: Pick<CloudStorage, 'delete'>; journal: UploadJournal;
}, now = new Date()): Promise<'resolved' | 'recent' | 'persisted' | 'compensated'> {
  if (['PERSISTED', 'COMPENSATED'].includes(event.phase)) return 'resolved';
  const age = now.getTime() - Date.parse(event.recordedAt);
  if (!Number.isFinite(age) || age < RECONCILIATION_DELAY_MS) return 'recent';
  const reference = { publicId: event.publicId, resourceType: event.resourceType };
  // Si DB falla se interrumpe: una consulta fallida nunca prueba ausencia.
  const row = await dependencies.lookup.find(reference);
  if (row) {
    await dependencies.journal.append({ ...reference, operationId: event.operationId, phase: 'PERSISTED', recordId: row.id });
    return 'persisted';
  }
  const result = await dependencies.cloud.delete(reference);
  if (result !== 'deleted' && result !== 'already_absent') throw new Error('Borrado cloud no confirmado.');
  await dependencies.journal.append({ ...reference, operationId: event.operationId, phase: 'COMPENSATED' });
  return 'compensated';
}
