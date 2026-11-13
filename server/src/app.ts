import express from 'express';
import { apiRouter } from './routes/api.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { configuredCors } from './config/cors.js';
import type { Environment } from './config/env.js';
import type { HealthCheck } from './services/health.js';

export function createApp(config: Pick<Environment, 'CLIENT_ORIGIN'>, healthCheck: HealthCheck) {
  const app = express();
  app.disable('x-powered-by');
  app.use(configuredCors(config.CLIENT_ORIGIN));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', apiRouter(healthCheck));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
