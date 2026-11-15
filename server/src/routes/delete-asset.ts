import { Router } from 'express';
import { HttpError } from '../middleware/errors.js';
import type { DeleteAsset } from '../services/delete-asset.js';

export function createDeleteRouter(remove: DeleteAsset) {
  const router = Router();
  router.delete('/:id', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const id = req.params.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      req.body !== undefined || Object.keys(req.query).length) {
      throw new HttpError(400, 'INVALID_DELETE', 'Envía únicamente el identificador válido del archivo en la ruta.');
    }
    await remove(id);
    res.status(204).end();
  });
  return router;
}
