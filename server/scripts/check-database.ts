import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { checkDatabase, createDatabase } from '../src/adapters/database.js';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Configura DATABASE_URL en server/.env.');
  process.exitCode = 1;
} else {
  const database = createDatabase(databaseUrl);
  try {
    await checkDatabase(database);
    // Comprueba también que la tabla y los campos de la migración existen.
    await database.activo.findFirst({ select: { id: true, estado: true } });
    console.info('Conexión Prisma/Neon y modelo Activo verificados.');
  } catch {
    console.error('No se pudo verificar la conexión o el modelo. Revisa el entorno local y las migraciones.');
    process.exitCode = 1;
  } finally {
    await database.$disconnect().catch(() => { process.exitCode = 1; });
  }
}
