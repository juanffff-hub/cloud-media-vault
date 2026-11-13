import cors from 'cors';
import { HttpError } from '../middleware/errors.js';

export function configuredCors(clientOrigin: string) {
  return cors({
    origin(origin, callback) {
      if (!origin || origin === clientOrigin) return callback(null, true);
      callback(new HttpError(400, 'ORIGIN_NOT_ALLOWED', 'Origen de solicitud no permitido.'));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
    maxAge: 600,
    optionsSuccessStatus: 204,
  });
}
