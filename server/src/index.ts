import { createApp } from './app.js';
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { ConfigurationError, readEnvironment } from './config/env.js';

loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
try {
  const config = readEnvironment(process.env);
  createApp(config).listen(config.PORT, '127.0.0.1', () => {
    console.info(`Cloud Media Vault API disponible en el puerto ${config.PORT}`);
  });
} catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : 'No se pudo iniciar el servidor.');
  process.exitCode = 1;
}
