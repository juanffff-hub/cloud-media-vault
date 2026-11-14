import type { CloudReference, MediaCategory } from './cloud-storage.js';

export interface AssetMetadata extends CloudReference {
  titulo: string;
  nombreOriginal: string;
  secureUrl: string;
  categoria: MediaCategory;
  mimeType: string;
  tamanoBytes: number;
  subidoPor: string;
}

export interface PersistedAsset extends AssetMetadata {
  id: string;
  fechaSubida: Date;
  estado: 'ACTIVO';
}

export interface AssetPersistence {
  // Debe resolver solo después de confirmar la escritura en PostgreSQL.
  create(metadata: AssetMetadata): Promise<PersistedAsset>;
}
