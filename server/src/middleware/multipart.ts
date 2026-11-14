import multer from 'multer';
import type { RequestHandler, Response } from 'express';
import { MAX_UPLOAD_BYTES, MAX_CONCURRENT_UPLOADS, MULTIPART_TIMEOUT_MS } from '../config/upload.js';
import { HttpError } from './errors.js';

export interface UploadSession {
  signal: AbortSignal;
  release(): void;
}

export function uploadSession(res: Response): UploadSession {
  return res.locals.uploadSession as UploadSession;
}

function multipartError(error: unknown): HttpError {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return new HttpError(413, 'FILE_TOO_LARGE', 'El archivo supera el límite de 10 MB.');
  }
  return new HttpError(400, 'INVALID_MULTIPART', 'Envía un archivo y los campos título y autor mediante multipart/form-data.');
}

export function createMultipartUpload(options: { concurrency?: number; timeoutMs?: number } = {}): RequestHandler {
  const concurrency = options.concurrency ?? MAX_CONCURRENT_UPLOADS;
  const timeoutMs = options.timeoutMs ?? MULTIPART_TIMEOUT_MS;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4 || timeoutMs < 1) {
    throw new Error('Configuración de ingesta inválida.');
  }
  let active = 0;
  const parse = multer({
    storage: multer.memoryStorage(),
    preservePath: false,
    defParamCharset: 'utf8',
    limits: {
      fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, parts: 3,
      fieldSize: 1024, fieldNameSize: 32, headerPairs: 20,
      fieldNestingDepth: 0, fieldArrayIndexLimit: 0,
    },
  }).single('archivo');

  return (req, res, next) => {
    if (!req.is('multipart/form-data')) return next(multipartError(undefined));
    if (active >= concurrency) {
      return next(new HttpError(500, 'UPLOAD_BUSY', 'Hay otras cargas en curso. Inténtalo de nuevo en unos segundos.'));
    }
    active++;
    const controller = new AbortController();
    let released = false;
    const timer = setTimeout(() => {
      controller.abort();
      req.destroy();
    }, timeoutMs);
    timer.unref();
    const abort = () => controller.abort();
    const close = () => { if (!res.writableFinished) abort(); };
    const release = () => {
      if (released) return;
      released = true;
      active--;
      clearTimeout(timer);
      req.off('aborted', abort);
      res.off('close', close);
      res.off('finish', release);
      if (req.file) req.file.buffer = Buffer.alloc(0);
    };
    res.locals.uploadSession = { signal: controller.signal, release } satisfies UploadSession;
    req.once('aborted', abort);
    res.once('close', close);
    res.once('finish', release);
    parse(req, res, error => {
      clearTimeout(timer);
      if (controller.signal.aborted) { release(); return; }
      if (error) return next(multipartError(error));
      next();
    });
  };
}
