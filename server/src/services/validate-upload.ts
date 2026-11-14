import { extname } from 'node:path';
import { Worker } from 'node:worker_threads';
import { MAX_UPLOAD_BYTES } from '../config/upload.js';
import { HttpError } from '../middleware/errors.js';
import type { CloudResourceType, MediaCategory } from './cloud-storage.js';

const formats: Record<string, { extensions: string[]; category: MediaCategory; resourceType: CloudResourceType }> = {
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], category: 'imagen', resourceType: 'image' },
  'image/png': { extensions: ['.png'], category: 'imagen', resourceType: 'image' },
  'image/webp': { extensions: ['.webp'], category: 'imagen', resourceType: 'image' },
  'video/mp4': { extensions: ['.mp4'], category: 'video', resourceType: 'video' },
  'video/webm': { extensions: ['.webm'], category: 'video', resourceType: 'video' },
  'application/pdf': { extensions: ['.pdf'], category: 'pdf', resourceType: 'image' },
};

export interface ValidatedUpload {
  buffer: Buffer;
  titulo: string;
  subidoPor: string;
  nombreOriginal: string;
  categoria: MediaCategory;
  resourceType: CloudResourceType;
  mimeType: string;
  tamanoBytes: number;
}

const invalid = () => new HttpError(400, 'INVALID_FILE', 'El contenido, la extensión y el tipo del archivo deben coincidir con un formato permitido.');

export async function inspectFile(buffer: Buffer, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new HttpError(400, 'UPLOAD_CANCELLED', 'La carga fue cancelada.');
  // Node 24 ejecuta el worker TS en desarrollo; el build usa el worker JS emitido.
  const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
  const worker = new Worker(new URL(`../workers/inspect-file.${extension}`, import.meta.url), {
    execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 48, stackSizeMb: 2 },
  });
  try {
    return await new Promise<string>((resolve, reject) => {
      const abort = () => reject(new HttpError(400, 'UPLOAD_CANCELLED', 'La carga fue cancelada.'));
      const timer = setTimeout(() => reject(invalid()), 3000);
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      worker.once('message', (result: { mime?: string } | null) => {
        cleanup();
        if (!result?.mime) reject(invalid()); else resolve(result.mime);
      });
      worker.once('error', () => { cleanup(); reject(invalid()); });
      worker.once('exit', () => { cleanup(); reject(invalid()); });
      signal?.addEventListener('abort', abort, { once: true });
      const copy = Uint8Array.from(buffer);
      worker.postMessage(copy, [copy.buffer]);
    });
  } finally { await worker.terminate(); }
}

function textField(body: Record<string, unknown>, name: string, max: number): string {
  const raw = body[name];
  if (typeof raw !== 'string') throw new HttpError(400, 'INVALID_FORM', 'El título y el autor son obligatorios.');
  const value = raw.normalize('NFC').trim();
  if (!value || value.length > max || /[\x00-\x1f\x7f-\x9f]/.test(value)) {
    throw new HttpError(400, 'INVALID_FORM', 'Revisa el título (máximo 160 caracteres) y el autor (máximo 100).');
  }
  return value;
}

export async function validateUpload(body: unknown, file?: Express.Multer.File, signal?: AbortSignal): Promise<ValidatedUpload> {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).some(key => !['titulo', 'subidoPor'].includes(key))) {
    throw new HttpError(400, 'INVALID_FORM', 'Envía únicamente título, autor y archivo.');
  }
  const titulo = textField(body as Record<string, unknown>, 'titulo', 160);
  const subidoPor = textField(body as Record<string, unknown>, 'subidoPor', 100);
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw new HttpError(400, 'FILE_REQUIRED', 'Selecciona un archivo con contenido.');
  }
  if (file.buffer.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'FILE_TOO_LARGE', 'El archivo supera el límite de 10 MB.');
  const format = Object.hasOwn(formats, file.mimetype) ? formats[file.mimetype] : undefined;
  const name = file.originalname.normalize('NFC').replaceAll('\\', '/').split('/').pop() ?? '';
  const extension = extname(name).toLowerCase();
  if (!format || !format.extensions.includes(extension)) throw invalid();
  const safe = name.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069<>:"|?*]/g, '_').trim();
  const nombreOriginal = safe.length > 255 ? safe.slice(0, 255 - extension.length) + extension : safe;
  if (!nombreOriginal || await inspectFile(file.buffer, signal) !== file.mimetype) throw invalid();
  return { buffer: file.buffer, titulo, subidoPor, nombreOriginal, categoria: format.category,
    resourceType: format.resourceType, mimeType: file.mimetype, tamanoBytes: file.buffer.length };
}
