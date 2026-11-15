import { Router } from 'express';
import { createMultipartUpload, uploadSession } from '../middleware/multipart.js';
import { createIngestionService, type IngestionDependencies } from '../services/ingest-asset.js';
import { validateUpload } from '../services/validate-upload.js';

// El punto de entrada de producción inyecta el repositorio Prisma y un diario durable.
export function createUploadRouter(dependencies: IngestionDependencies) {
  const ingest = createIngestionService(dependencies);
  const router = Router();
  router.post('/', createMultipartUpload(), async (req, res) => {
    const session = uploadSession(res);
    try {
      const input = await validateUpload(req.body, req.file, session.signal);
      const record = await ingest(input, session.signal);
      if (!res.destroyed) res.status(201).json({ data: record });
    } finally { session.release(); }
  });
  return router;
}
