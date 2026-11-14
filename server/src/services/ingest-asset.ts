import { HttpError } from '../middleware/errors.js';
import { randomUUID } from 'node:crypto';
import { CloudStorageError, type CloudStorage, type CloudReference } from './cloud-storage.js';
import type { AssetPersistence } from './asset-persistence.js';
import type { ValidatedUpload } from './validate-upload.js';
import type { UploadJournal, UploadPhase, UploadReason } from './upload-journal.js';

export interface IngestionDependencies {
  cloud: CloudStorage;
  persistence: AssetPersistence;
  journal: UploadJournal;
}

export function createIngestionService({ cloud, persistence, journal }: IngestionDependencies) {
  if (typeof persistence?.create !== 'function') throw new Error('La ingesta requiere persistencia conectada.');
  if (typeof journal?.append !== 'function') throw new Error('La ingesta requiere un registro durable.');
  return async (input: ValidatedUpload, signal?: AbortSignal) => {
    const operationId = randomUUID();
    let prepared: CloudReference | undefined;
    const record = (phase: UploadPhase, reference: CloudReference, reasonCode?: UploadReason, recordId?: string) =>
      journal.append({ operationId, ...reference, phase, reasonCode, recordId });
    const safeRecord = async (phase: UploadPhase, reference: CloudReference, reasonCode?: UploadReason, recordId?: string) => {
      try { await record(phase, reference, reasonCode, recordId); }
      catch {
        console.error(JSON.stringify({ event: 'UPLOAD_JOURNAL_WRITE_FAILED', operationId,
          publicId: reference.publicId, resourceType: reference.resourceType, phase, reasonCode }));
      }
    };
    const compensate = async (reference: CloudReference, reason: UploadReason, uncertain = false) => {
      let removed = false;
      try {
        const result = await cloud.delete(reference);
        removed = result === 'deleted' || result === 'already_absent';
      } catch { /* Se conserva PREPARED aunque falle el siguiente registro. */ }
      // Una subida sin respuesta podría terminar después del destroy: no darla por resuelta.
      const phase = removed && !uncertain ? 'COMPENSATED' : 'RECONCILIATION_REQUIRED';
      await safeRecord(phase, reference, reason);
      if (phase === 'RECONCILIATION_REQUIRED') console.error(JSON.stringify({ event: phase, operationId,
        publicId: reference.publicId, resourceType: reference.resourceType, reasonCode: reason }));
    };
    let asset;
    try {
      asset = await cloud.upload({ buffer: input.buffer, category: input.categoria, signal,
        onPrepared: async reference => { await record('PREPARED', reference); prepared = reference; },
      });
    } catch (error) {
      if (prepared) await compensate(prepared, 'CLOUD_UPLOAD_FAILED', true);
      if (error instanceof CloudStorageError && error.code === 'UPLOAD_CANCELLED') {
        throw new HttpError(400, 'UPLOAD_CANCELLED', 'La carga fue cancelada.');
      }
      throw new HttpError(500, 'CLOUD_UPLOAD_FAILED', 'No se pudo subir el archivo. Inténtalo de nuevo.');
    }
    const reference = { publicId: asset.publicId, resourceType: asset.resourceType };
    try { await record('UPLOAD_CONFIRMED', reference); }
    catch {
      await compensate(reference, 'JOURNAL_FAILED');
      throw new HttpError(500, 'JOURNAL_UNAVAILABLE', 'No se pudo completar la carga. Inténtalo de nuevo.');
    }
    if (signal?.aborted) {
      await compensate(reference, 'CLIENT_DISCONNECTED');
      throw new HttpError(400, 'UPLOAD_CANCELLED', 'La carga fue cancelada.');
    }
    let persisted;
    try {
      persisted = await persistence.create({
        titulo: input.titulo, subidoPor: input.subidoPor, nombreOriginal: input.nombreOriginal,
        categoria: input.categoria, mimeType: input.mimeType, tamanoBytes: asset.bytes,
        secureUrl: asset.secureUrl, publicId: asset.publicId, resourceType: asset.resourceType,
      });
      if (!persisted?.id || !(persisted.fechaSubida instanceof Date) || persisted.publicId !== asset.publicId ||
        persisted.secureUrl !== asset.secureUrl || persisted.resourceType !== asset.resourceType || persisted.estado !== 'ACTIVO') {
        throw new Error('Persistence did not confirm the asset');
      }
    } catch {
      await compensate(reference, 'PERSISTENCE_FAILED');
      throw new HttpError(500, 'PERSISTENCE_FAILED', 'No se pudo guardar el archivo. Inténtalo de nuevo.');
    }
    // Si DB ya confirmó, un fallo del diario no autoriza borrar un activo persistido.
    await safeRecord('PERSISTED', reference, undefined, persisted.id);
    return persisted;
  };
}
