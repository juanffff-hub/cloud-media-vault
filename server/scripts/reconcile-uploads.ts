import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { readEnvironment } from '../src/config/env.js';
import { createDatabase } from '../src/adapters/database.js';
import { createCloudinaryStorage } from '../src/adapters/cloudinary.js';
import { createUploadJournal, readUploadJournal } from '../src/adapters/upload-journal.js';
import { reconcileUpload } from '../src/services/reconcile-upload.js';
import { loadDatabaseTarget } from './database-env.mjs';

loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
let database: ReturnType<typeof createDatabase> | undefined;
try {
  const args = process.argv.slice(2);
  const operationId = args[0] === '--operation' ? args[1] : undefined;
  if (args.length && (args.length !== 2 || !/^[0-9a-f-]{36}$/i.test(operationId ?? ''))) throw new Error('Invalid arguments');
  const config = readEnvironment(process.env);
  const pending = (await readUploadJournal()).filter(event => !['PERSISTED', 'COMPENSATED'].includes(event.phase) &&
    event.publicId.startsWith(`${config.CLOUDINARY_FOLDER}/`));
  if (!operationId) console.info(JSON.stringify({ pendientes: pending.map(({ operationId, phase, recordedAt }) => ({ operationId, phase, recordedAt })) }));
  else {
    const event = pending.find(candidate => candidate.operationId === operationId);
    if (!event) throw new Error('No pending operation');
    const db = database = createDatabase(loadDatabaseTarget(false).databaseUrl);
    const result = await reconcileUpload(event, {
      cloud: createCloudinaryStorage(config), journal: createUploadJournal(),
      lookup: { find: reference => db.activo.findUnique({ where: { publicId_resourceType: reference }, select: { id: true } }) },
    });
    console.info(JSON.stringify({ operationId, resultado: result }));
    if (result === 'recent') process.exitCode = 1;
  }
} catch {
  console.error('No se pudo reconciliar. Revisa operación, conexiones y diario; un diario dañado debe revisarse sin descartar referencias.');
  process.exitCode = 1;
} finally { await database?.$disconnect().catch(() => { process.exitCode = 1; }); }
