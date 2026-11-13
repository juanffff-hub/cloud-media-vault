import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigurationError, readEnvironment } from '../src/config/env.js';

loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
try {
  const config = readEnvironment(process.env);
  const response = await cloudinary.api.ping({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    timeout: config.CLOUDINARY_TIMEOUT_MS,
  });
  if (response.status !== 'ok') throw new Error();
  console.info('Autenticación y disponibilidad de Cloudinary verificadas.');
} catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : 'No se pudo verificar Cloudinary. Revisa credenciales y conexión local.');
  process.exitCode = 1;
}
