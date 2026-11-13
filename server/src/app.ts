import express from 'express';
import { apiRouter } from './routes/api.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', apiRouter());
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
