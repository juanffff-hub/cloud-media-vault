import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { loadDatabaseTarget } from '../../scripts/database-env.mjs';
import { checkDatabase, createDatabase } from '../../src/adapters/database.js';
import { createApp } from '../../src/app.js';
import { createHealthCheck } from '../../src/services/health.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

let database: PrismaClient | undefined;
const createdIds: string[] = [];
let stage = 'configuración de la base separada';

try {
  const target = loadDatabaseTarget(true);
  database = createDatabase(target.databaseUrl);
  const db = database;
  stage = 'conexión y migración';
  await checkDatabase(db);
  const migrations = await db.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `;
  assert(migrations.some(row => row.migration_name === '20261113000100_create_activos'));

  stage = 'persistencia de metadatos';
  const runId = randomUUID();
  const data = {
    titulo: `Prueba arquitectura ${runId}`,
    nombreOriginal: 'prueba-arquitectura.png',
    secureUrl: 'https://res.cloudinary.com/test/image/upload/metadata-only.png',
    publicId: `cloud-media-vault/db-check/${runId}`,
    resourceType: 'image' as const,
    categoria: 'imagen' as const,
    mimeType: 'image/png',
    tamanoBytes: 1234,
    subidoPor: 'Prueba aislada de arquitectura',
  };
  const asset = await db.activo.create({ data });
  createdIds.push(asset.id);
  assert.match(asset.id, /^[0-9a-f-]{36}$/);
  assert.equal(asset.estado, 'ACTIVO');
  assert.equal(asset.intentosBorrado, 0);
  assert(asset.fechaSubida instanceof Date);
  assert.equal((await db.activo.findUniqueOrThrow({ where: { id: asset.id } })).publicId, data.publicId);
  // Este registro es solo una referencia sintética en la base de pruebas; no se crea un binario.

  stage = 'restricciones e índices SQL';
  const indexes = await db.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Activo'
  `;
  assert(indexes.some(row => row.indexname === 'Activo_titulo_trgm_idx'));
  const columns = await db.$queryRaw<Array<{ data_type: string }>>`
    SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Activo'
  `;
  assert(!columns.some(row => row.data_type === 'bytea'));
  await assert.rejects(() => db.activo.create({ data })); // Identidad cloud duplicada.
  for (const override of [
    { tamanoBytes: 10_485_761 }, { tamanoBytes: 0 }, { titulo: '  ' },
    { secureUrl: 'http://example.test/insecure' }, { categoria: 'pdf' as const },
  ]) {
    // Transacción con rollback explícito si una restricción faltara: no deja filas de prueba.
    const rejected = await db.$transaction(async tx => {
      await tx.activo.create({ data: { ...data, publicId: `cloud-media-vault/db-check/${randomUUID()}`, ...override } });
      throw new Error('CONSTRAINT_NOT_ENFORCED');
    }).then(() => false, error => {
      if (error instanceof Error && error.message === 'CONSTRAINT_NOT_ENFORCED') return false;
      return true;
    });
    assert(rejected, 'La base no aplicó una restricción requerida.');
  }

  stage = 'consulta por título y estado operativo';
  const matches = await db.activo.findMany({
    where: { titulo: { contains: runId.toUpperCase(), mode: 'insensitive' }, estado: 'ACTIVO' },
    orderBy: [{ fechaSubida: 'desc' }, { id: 'desc' }],
  });
  assert.equal(matches.length, 1);
  await db.activo.update({ where: { id: asset.id }, data: { estado: 'ELIMINANDO', intentosBorrado: { increment: 1 }, borradoIniciadoEn: new Date() } });
  assert.equal(await db.activo.count({ where: { id: asset.id, estado: 'ACTIVO' } }), 0);

  stage = 'salud HTTP y CORS con conexión real';
  const origin = 'http://127.0.0.1:5173';
  const app = createApp({ CLIENT_ORIGIN: origin }, createHealthCheck(() => checkDatabase(db)));
  const response = await request(app).get('/api/health').set('Origin', origin);
  assert.equal(response.status, 200);
  assert.equal(response.headers['access-control-allow-origin'], origin);

  stage = 'limpieza de los registros propios';
  await db.activo.delete({ where: { id: asset.id } });
  assert.equal(await db.activo.count({ where: { id: asset.id } }), 0);
  console.info('PASS: migración, persistencia, restricciones, índices, búsqueda, estado, health/CORS y borrado de la prueba en PostgreSQL.');
} catch {
  console.error(`FAIL: ${stage}. Revisa configuración, migración y conexión; se omiten detalles del proveedor.`);
  process.exitCode = 1;
} finally {
  if (database) {
    try {
      if (createdIds.length) await database.activo.deleteMany({ where: { id: { in: createdIds } } });
    } catch {
      console.error('No se pudo completar la limpieza. IDs exclusivos de esta prueba:', createdIds.join(', '));
      process.exitCode = 1;
    }
    await database.$disconnect().catch(() => { process.exitCode = 1; });
  }
}
