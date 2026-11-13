import { Router } from 'express';

export function apiRouter() {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ data: { nombre: 'Cloud Media Vault', version: '0.1.0' } });
  });
  return router;
}
