export type MediaCategory = 'imagen' | 'video' | 'pdf';
export type CloudResourceType = 'image' | 'video';

export interface CloudReference {
  publicId: string;
  resourceType: CloudResourceType;
}

export interface CloudAsset extends CloudReference {
  secureUrl: string;
  bytes: number;
  format: string;
}

export interface CloudStorage {
  upload(input: { buffer: Buffer; category: MediaCategory }): Promise<CloudAsset>;
  delete(reference: CloudReference): Promise<'deleted' | 'already_absent'>;
}

export class CloudStorageError extends Error {
  constructor(
    public readonly code: 'INVALID_UPLOAD' | 'UPLOAD_FAILED' | 'INVALID_CLOUD_RESPONSE' | 'INVALID_REFERENCE' | 'DELETE_FAILED',
    // Permite reconciliar una operación incierta sin guardar respuestas o secretos del proveedor.
    public readonly candidate?: CloudReference,
  ) {
    super('No se pudo completar la operación de almacenamiento.');
    this.name = 'CloudStorageError';
  }
}
