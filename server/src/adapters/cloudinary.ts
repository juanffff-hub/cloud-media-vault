import { randomUUID } from 'node:crypto';
import type { Writable } from 'node:stream';
import { v2 as cloudinary, type UploadApiOptions, type UploadResponseCallback } from 'cloudinary';
import type { Environment } from '../config/env.js';
import { CloudStorageError, type CloudStorage, type CloudResourceType, type MediaCategory } from '../services/cloud-storage.js';

export interface CloudinaryGateway {
  uploadStream(options: UploadApiOptions, callback: UploadResponseCallback): Writable;
  destroy(publicId: string, options: UploadApiOptions): Promise<{ result: string }>;
}

const sdkGateway: CloudinaryGateway = {
  uploadStream: (options, callback) => cloudinary.uploader.upload_stream(options, callback),
  destroy: (publicId, options) => cloudinary.uploader.destroy(publicId, options),
};

const types: Record<MediaCategory, { resourceType: CloudResourceType; formats: string[] }> = {
  imagen: { resourceType: 'image', formats: ['jpg', 'jpeg', 'png', 'webp'] },
  video: { resourceType: 'video', formats: ['mp4', 'webm'] },
  pdf: { resourceType: 'image', formats: ['pdf'] },
};

type CloudConfig = Pick<Environment, 'CLOUDINARY_CLOUD_NAME' | 'CLOUDINARY_API_KEY' |
  'CLOUDINARY_API_SECRET' | 'CLOUDINARY_FOLDER' | 'CLOUDINARY_TIMEOUT_MS' | 'MAX_FILE_SIZE_BYTES'>;

export function createCloudinaryStorage(config: CloudConfig, gateway: CloudinaryGateway = sdkGateway): CloudStorage {
  // Configuración por llamada: no estado global mutable ni credenciales en React.
  const credentials = {
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    secure: true,
    timeout: config.CLOUDINARY_TIMEOUT_MS,
  };

  return {
    async upload({ buffer, category }) {
      const media = types[category];
      if (!media || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length > config.MAX_FILE_SIZE_BYTES) {
        throw new CloudStorageError('INVALID_UPLOAD');
      }
      const candidate = { publicId: `${config.CLOUDINARY_FOLDER}/${randomUUID()}`, resourceType: media.resourceType };
      return new Promise((resolve, reject) => {
        try {
          const stream = gateway.uploadStream({
            ...credentials,
            public_id: candidate.publicId,
            resource_type: media.resourceType,
            type: 'upload',
            overwrite: false,
            use_filename: false,
            unique_filename: false,
            allowed_formats: media.formats,
          }, (error, result) => {
            if (error) return reject(new CloudStorageError('UPLOAD_FAILED', candidate));
            let isHttps = false;
            try {
              const url = new URL(result?.secure_url ?? '');
              isHttps = url.protocol === 'https:' && !url.username && !url.password;
            } catch { /* Respuesta inválida; no reflejar datos del proveedor. */ }
            if (!result || !isHttps || result.public_id !== candidate.publicId ||
              result.resource_type !== media.resourceType || !media.formats.includes(result.format) ||
              !Number.isSafeInteger(result.bytes) || result.bytes <= 0 || result.bytes > config.MAX_FILE_SIZE_BYTES) {
              return reject(new CloudStorageError('INVALID_CLOUD_RESPONSE', candidate));
            }
            resolve({ secureUrl: result.secure_url, publicId: result.public_id,
              resourceType: result.resource_type as CloudResourceType, bytes: result.bytes, format: result.format });
          });
          stream.once('error', () => reject(new CloudStorageError('UPLOAD_FAILED', candidate)));
          stream.end(buffer);
        } catch { reject(new CloudStorageError('UPLOAD_FAILED', candidate)); }
      });
    },
    async delete(reference) {
      if (!reference.publicId.startsWith(`${config.CLOUDINARY_FOLDER}/`) ||
        reference.publicId.includes('..') || reference.publicId.includes('\\') ||
        !['image', 'video'].includes(reference.resourceType)) {
        throw new CloudStorageError('INVALID_REFERENCE');
      }
      try {
        const response = await gateway.destroy(reference.publicId, {
          ...credentials, resource_type: reference.resourceType, type: 'upload', invalidate: true,
        });
        if (response.result === 'ok') return 'deleted';
        if (response.result === 'not found') return 'already_absent';
        throw new Error('Unconfirmed deletion');
      } catch { throw new CloudStorageError('DELETE_FAILED', reference); }
    },
  };
}
