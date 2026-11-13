import { afterEach, expect, test, vi } from 'vitest';
import { loadDatabaseTarget } from '../scripts/database-env.mjs';

vi.mock('node:fs', () => ({ readFileSync: vi.fn(() => Buffer.from('')) }));
afterEach(() => vi.unstubAllEnvs());

function stubConnections() {
  vi.stubEnv('DATABASE_URL', 'postgresql://unit:unit@sample-pooler.neon.tech/cloud_media_vault');
  vi.stubEnv('DIRECT_URL', 'postgresql://unit:unit@sample.neon.tech/cloud_media_vault');
  vi.stubEnv('TEST_DATABASE_URL', 'postgresql://unit:unit@sample-pooler.neon.tech/cloud_media_vault_test');
  vi.stubEnv('TEST_DIRECT_URL', 'postgresql://unit:unit@sample.neon.tech/cloud_media_vault_test');
}

test('pruebas usan exclusivamente la base separada y migran por conexión directa', () => {
  stubConnections();
  const target = loadDatabaseTarget(true);
  expect(new URL(target.databaseUrl).pathname).toBe('/cloud_media_vault_test');
  expect(new URL(target.directUrl).hostname).toBe('sample.neon.tech');
});

test('rechaza ejecutar pruebas sobre la base de uso normal', () => {
  stubConnections();
  vi.stubEnv('TEST_DATABASE_URL', process.env.DATABASE_URL!);
  expect(() => loadDatabaseTarget(true)).toThrow('base exclusiva');
});

test('rechaza usar la misma base como aplicación y pruebas', () => {
  stubConnections();
  vi.stubEnv('DATABASE_URL', process.env.TEST_DATABASE_URL!);
  expect(() => loadDatabaseTarget(true)).toThrow('distinta');
});

test('rechaza migraciones mediante el pooler', () => {
  stubConnections();
  vi.stubEnv('TEST_DIRECT_URL', process.env.TEST_DATABASE_URL!);
  expect(() => loadDatabaseTarget(true)).toThrow('sin pooling');
});

test('rechaza conexiones de ejecución y migración que apuntan a servidores distintos', () => {
  stubConnections();
  vi.stubEnv('TEST_DIRECT_URL', 'postgresql://unit:unit@other.neon.tech/cloud_media_vault_test');
  expect(() => loadDatabaseTarget(true)).toThrow('misma base');
});

test('un valor inválido no se incluye en el error', () => {
  stubConnections();
  vi.stubEnv('TEST_DATABASE_URL', 'secret-invalid-value');
  try { loadDatabaseTarget(true); throw new Error('No rechazó la configuración.'); }
  catch (error) {
    expect(String(error)).toContain('TEST_DATABASE_URL');
    expect(String(error)).not.toContain('secret-invalid-value');
  }
});
