import { HttpError } from '../middleware/errors.js';
import { CloudStorageError, type CloudStorage } from './cloud-storage.js';
import type { AssetPersistence } from './asset-persistence.js';
import type { ValidatedUpload } from './validate-upload.js';

export interface IngestionDependencies {
  cloud: CloudStorage;
  persistence: AssetPersistence;
}

export function createIngestionService({ cloud, persistence }: IngestionDependencies) {
  if (typeof persistence?.create !== 'function') throw new Error('La ingesta requiere persistencia conectada.');
  return async (input: ValidatedUpload, signal?: AbortSignal) => {
    let asset;
    try {
      asset = await cloud.upload({ buffer: input.buffer, category: input.categoria, signal });
    } catch (error) {
      if (error instanceof CloudStorageError && error.code === 'UPLOAD_CANCELLED') {
        throw new HttpError(400, 'UPLOAD_CANCELLED', 'La carga fue cancelada.');
      }
      throw new HttpError(500, 'CLOUD_UPLOAD_FAILED', 'No se pudo subir el archivo. Inténtalo de nuevo.');
    }
    try {
      if (signal?.aborted) throw new Error('Client disconnected');
      const record = await persistence.create({
        titulo: input.titulo, subidoPor: input.subidoPor, nombreOriginal: input.nombreOriginal,
        categoria: input.categoria, mimeType: input.mimeType, tamanoBytes: asset.bytes,
        secureUrl: asset.secureUrl, publicId: asset.publicId, resourceType: asset.resourceType,
      });
      if (!record?.id || !(record.fechaSubida instanceof Date) || record.publicId !== asset.publicId ||
        record.secureUrl !== asset.secureUrl || record.resourceType !== asset.resourceType || record.estado !== 'ACTIVO') {
        throw new Error('Persistence did not confirm the asset');
      }
      return record;
    } catch {
      throw new HttpError(500, 'PERSISTENCE_FAILED', 'No se pudo guardar el archivo. Inténtalo de nuevo.');
    }
  };
}
