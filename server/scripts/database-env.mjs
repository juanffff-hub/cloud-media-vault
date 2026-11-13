import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

function readLocalFile(name) {
  try { return parse(readFileSync(new URL(`../${name}`, import.meta.url))); }
  catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error('No se pudo leer el archivo local de entorno.');
  }
}

function parseConnection(value, field) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error();
    return url;
  } catch { throw new Error(`Configura ${field} localmente; se requiere una URL PostgreSQL válida.`); }
}

export function loadDatabaseTarget(test = false) {
  const normal = { ...readLocalFile('.env'), ...process.env };
  const isolated = { ...readLocalFile('.env.test'), ...process.env };
  const source = test ? isolated : normal;
  const runtimeField = test ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  const directField = test ? 'TEST_DIRECT_URL' : 'DIRECT_URL';
  const runtime = parseConnection(source[runtimeField], runtimeField);
  const direct = parseConnection(source[directField], directField);
  const expectedName = test ? '/cloud_media_vault_test' : '/cloud_media_vault';
  const host = (url) => url.hostname.replace(/-pooler(?=\.)/, '');
  if (runtime.pathname !== expectedName || direct.pathname !== expectedName || host(runtime) !== host(direct)) {
    throw new Error('Las conexiones deben apuntar a la misma base exclusiva: cloud_media_vault o cloud_media_vault_test según el comando.');
  }
  if (direct.hostname.includes('-pooler.')) throw new Error(`${directField} debe usar conexión sin pooling.`);
  if (test && normal.DATABASE_URL) {
    const production = parseConnection(normal.DATABASE_URL, 'DATABASE_URL');
    if (production.pathname === runtime.pathname && host(production) === host(runtime)) {
      throw new Error('La base de pruebas debe ser distinta a la base de la aplicación.');
    }
  }
  return { databaseUrl: runtime.href, directUrl: direct.href };
}
