import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadDatabaseTarget } from './database-env.mjs';

try {
  const isTest = process.argv.includes('--test');
  const target = loadDatabaseTarget(isTest);
  const require = createRequire(import.meta.url);
  const command = process.argv.includes('--status') ? 'status' : 'deploy';
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', command], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: target.databaseUrl, DIRECT_URL: target.directUrl },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  });
  const confirmed = command === 'status'
    ? /Database schema is up to date/.test(result.stdout ?? '')
    : /All migrations have been successfully applied|No pending migrations to apply/.test(result.stdout ?? '');
  if (result.error || result.status !== 0 || !confirmed) {
    const code = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.match(/\bP\d{4}\b/)?.[0];
    throw new Error(`Prisma no pudo completar la migración${code ? ` (${code})` : ''}. Revisa conectividad, permisos y variables locales.`);
  }
  console.info(`Migraciones ${command === 'status' ? 'verificadas' : 'aplicadas'} en la base ${isTest ? 'de pruebas' : 'de la aplicación'}.`);
} catch (error) {
  // Los errores creados en estos scripts contienen nombres de variables, nunca sus valores.
  console.error(error.message);
  process.exitCode = 1;
}
