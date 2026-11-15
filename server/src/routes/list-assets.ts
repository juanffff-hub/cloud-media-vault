import { Router } from 'express';
import { parseAssetQuery, type AssetListing } from '../services/list-assets.js';

export function createListRouter(repository: AssetListing) {
  const router = Router();
  router.get('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await repository.list(parseAssetQuery(req.query)));
  });
  return router;
}
