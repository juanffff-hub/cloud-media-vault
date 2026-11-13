import { createApp } from './app.js';
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { ConfigurationError, readEnvironment } from './config/env.js';
import { checkDatabase, createDatabase } from './adapters/database.js';
import { createHealthCheck } from './services/health.js';

loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
try {
  const config = readEnvironment(process.env);
  const database = createDatabase(config.DATABASE_URL);
  const healthCheck = createHealthCheck(() => checkDatabase(database));
  const server = createApp(config, healthCheck).listen(config.PORT, '127.0.0.1', () => {
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
