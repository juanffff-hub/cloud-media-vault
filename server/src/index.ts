import { createApp } from './app.js';
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { ConfigurationError, readEnvironment } from './config/env.js';
import { checkDatabase, createDatabase } from './adapters/database.js';
import { createHealthCheck } from './services/health.js';
import { createAssetRepository } from './adapters/asset-repository.js';
import { createCloudinaryStorage } from './adapters/cloudinary.js';
import { createUploadJournal } from './adapters/upload-journal.js';
import { createDeletionRepository } from './adapters/deletion-repository.js';
import { createDeleteAsset } from './services/delete-asset.js';

loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
try {
  const config = readEnvironment(process.env);
  const database = createDatabase(config.DATABASE_URL);
  const healthCheck = createHealthCheck(() => checkDatabase(database));
  const persistence = createAssetRepository(database);
  const cloud = createCloudinaryStorage(config);
  const journal = createUploadJournal();
  const remove = createDeleteAsset(createDeletionRepository(database), cloud);
  const server = createApp(config, healthCheck, { upload: { persistence, cloud, journal }, list: persistence, remove }).listen(config.PORT, '127.0.0.1', () => {
    console.info(`Cloud Media Vault API disponible en el puerto ${config.PORT}`);
  });
  server.on('error', async () => {
    console.error('No se pudo abrir el puerto del servidor.');
    await database.$disconnect().catch(() => {});
    process.exitCode = 1;
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    server.close(async () => {
      await database.$disconnect().catch(() => { process.exitCode = 1; });
      clearTimeout(deadline);
    });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : 'No se pudo iniciar el servidor.');
  process.exitCode = 1;
}
