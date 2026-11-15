import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { readEnvironment } from '../src/config/env.js';
import { createDatabase } from '../src/adapters/database.js';
import { createCloudinaryStorage } from '../src/adapters/cloudinary.js';
import { createDeletionRepository } from '../src/adapters/deletion-repository.js';
import { createDeleteAsset } from '../src/services/delete-asset.js';
import { loadDatabaseTarget } from './database-env.mjs';
import { HttpError } from '../src/middleware/errors.js';

loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
let database: ReturnType<typeof createDatabase> | undefined;
try {
  const args = process.argv.slice(2);
  const idIndex = args.indexOf('--id');
  const id = idIndex >= 0 ? args[idIndex + 1] : undefined;
  if (args.some((arg, index) => arg !== '--test' && !(idIndex >= 0 && (index === idIndex || index === idIndex + 1))) ||
    (idIndex >= 0 && !/^[0-9a-f-]{36}$/i.test(id ?? ''))) throw new Error('Invalid arguments');
  const config = readEnvironment(process.env);
  database = createDatabase(loadDatabaseTarget(args.includes('--test')).databaseUrl);
  const rows = await database.activo.findMany({
    where: { id, estado: { not: 'ACTIVO' }, publicId: { startsWith: `${config.CLOUDINARY_FOLDER}/` } },
    select: { id: true, estado: true, intentosBorrado: true, borradoIniciadoEn: true, ultimoErrorCodigo: true },
    orderBy: [{ actualizadoEn: 'asc' }, { id: 'asc' }], take: 50,
  });
  if (!id) console.info(JSON.stringify({ pendientes: rows, maximo: 50 }));
  else {
    if (rows.length !== 1) throw new Error('No pending project asset');
    await createDeleteAsset(createDeletionRepository(database), createCloudinaryStorage(config))(id);
    console.info(JSON.stringify({ resultado: 'eliminado', id }));
  }
} catch (error) {
  console.error(error instanceof HttpError ? `${error.code}: ${error.message}` : 'No se pudo recuperar el borrado. Revisa argumentos, entorno y conexión; el activo debe estar pendiente.');
  process.exitCode = 1;
} finally { await database?.$disconnect().catch(() => { process.exitCode = 1; }); }
