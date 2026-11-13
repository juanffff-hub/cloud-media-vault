import type { ErrorRequestHandler, RequestHandler } from 'express';

// Solo se usan mensajes estáticos, seguros para exponer al cliente.
export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo JSON no es válido.' } });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'La solicitud supera el tamaño permitido.' } });
    return;
  }
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'No se pudo completar la operación.' } });
};
