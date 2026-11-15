import express from 'express';
import { apiRouter } from './routes/api.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { configuredCors } from './config/cors.js';
import type { Environment } from './config/env.js';
import type { HealthCheck } from './services/health.js';
import { createUploadRouter } from './routes/upload.js';
import type { IngestionDependencies } from './services/ingest-asset.js';
import { createListRouter } from './routes/list-assets.js';
import type { AssetListing } from './services/list-assets.js';

export interface ApplicationServices {
  upload?: IngestionDependencies;
  list?: AssetListing;
}

export function createApp(config: Pick<Environment, 'CLIENT_ORIGIN'>, healthCheck: HealthCheck, services: ApplicationServices = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(configuredCors(config.CLIENT_ORIGIN));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', apiRouter(healthCheck));
  if (services.upload) app.use('/api/archivos', createUploadRouter(services.upload));
  if (services.list) app.use('/api/archivos', createListRouter(services.list));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
