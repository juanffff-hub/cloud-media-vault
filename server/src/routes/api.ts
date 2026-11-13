import { Router } from 'express';
import type { HealthCheck } from '../services/health.js';

export function apiRouter(healthCheck: HealthCheck) {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ data: { nombre: 'Cloud Media Vault', version: '0.1.0' } });
  });
  router.get('/health', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: await healthCheck() });
  });
  return router;
}
