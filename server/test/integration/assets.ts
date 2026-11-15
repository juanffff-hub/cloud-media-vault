import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { loadDatabaseTarget } from '../../scripts/database-env.mjs';
import { createDatabase } from '../../src/adapters/database.js';
import { createAssetRepository } from '../../src/adapters/asset-repository.js';
import { createDeletionRepository } from '../../src/adapters/deletion-repository.js';
import { createDeleteAsset, DELETION_LEASE_MS } from '../../src/services/delete-asset.js';
import { CloudStorageError, type CloudStorage, type CloudAsset } from '../../src/services/cloud-storage.js';
import type { UploadEvent } from '../../src/services/upload-journal.js';
import { createApp } from '../../src/app.js';
import { healthyProbe } from '../fixtures.js';
import { tinyPng, tinyPdf, structuralMp4 } from '../media-fixtures.js';

const runId = randomUUID();
const prefix = `cloud-media-vault/test-crud/${runId}/`;
let database: ReturnType<typeof createDatabase> | undefined;
let stage = 'conexión a base de prueba separada';
try {
  const db = database = createDatabase(loadDatabaseTarget(true).databaseUrl);
  const repository = createAssetRepository(db);
  let now = new Date();
  const store = createDeletionRepository(db, () => now);
  const events: UploadEvent[] = [];
  const journal = { append: async (event: UploadEvent) => { events.push(event); } };
  const remote = new Map<string, CloudAsset>();
  let failUpload = false, failCloudDelete = false, failMark = false, failRemove = false;
  let beforeDelete: (() => Promise<void>) | undefined;
  let deleteCalls = 0;
  const cloud: CloudStorage = {
    async upload(input) {
      const type = input.category === 'video' ? 'video' : 'image';
      const format = input.category === 'pdf' ? 'pdf' : input.category === 'video' ? 'mp4' : 'png';
      const asset: CloudAsset = { publicId: prefix + randomUUID(), resourceType: type,
        secureUrl: `https://res.cloudinary.com/test/${type}/upload/${randomUUID()}.${format}`, bytes: input.buffer.length, format };
      await input.onPrepared?.(asset);
      if (failUpload) throw new CloudStorageError('UPLOAD_FAILED', asset);
      remote.set(asset.publicId, asset);
      return asset;
    },
    async delete(reference) {
      deleteCalls++;
      await beforeDelete?.();
      if (failCloudDelete) throw new CloudStorageError('DELETE_FAILED', reference);
      return remote.delete(reference.publicId) ? 'deleted' : 'already_absent';
    },
  };
  const faultStore = { ...store,
    markCloudRemoved: async (ticket: Parameters<typeof store.markCloudRemoved>[0]) => {
      if (failMark) throw new Error('Simulated DB interruption');
      await store.markCloudRemoved(ticket);
    },
    remove: async (ticket: Parameters<typeof store.remove>[0]) => {
      if (failRemove) throw new Error('Simulated DB interruption');
      await store.remove(ticket);
    },
  };
  const makeApp = (persistence = repository) => createApp({ CLIENT_ORIGIN: 'http://127.0.0.1:5173' }, healthyProbe,
    { upload: { persistence, cloud, journal }, list: repository, remove: createDeleteAsset(faultStore, cloud) });
  const app = makeApp();
  const post = (name: string, bytes = tinyPng(), filename = 'archivo.png', target = app) => request(target).post('/api/archivos')
    .field('titulo', `${runId} ${name}`).field('subidoPor', 'Prueba CRUD Sebastian').attach('archivo', bytes, filename);
  const countOwn = () => db.activo.count({ where: { publicId: { startsWith: prefix } } });

  stage = 'POST y metadatos de tres categorías';
  const inputs = [['100%_', tinyPng(), 'foto.png', 'imagen', 'image'], ['Informe', tinyPdf(), 'archivo.pdf', 'pdf', 'image'],
    ['Clip', structuralMp4(), 'clip.mp4', 'video', 'video']] as const;
  const ids: string[] = [];
  for (const [index, [title, bytes, filename, category, type]] of inputs.entries()) {
    const response = await post(title, bytes, filename);
    assert.equal(response.status, 201);
    const row = await db.activo.findUniqueOrThrow({ where: { id: response.body.data.id } });
    ids.push(row.id);
    assert.equal(row.categoria, category); assert.equal(row.resourceType, type);
    assert.equal(row.nombreOriginal, filename); assert.equal(row.tamanoBytes, bytes.length);
    assert.equal(row.subidoPor, 'Prueba CRUD Sebastian'); assert.equal(row.secureUrl, response.body.data.secureUrl);
    assert(remote.has(row.publicId)); assert.equal(row.estado, 'ACTIVO');
    assert(!('buffer' in response.body.data));
    await db.activo.update({ where: { id: row.id }, data: { fechaSubida: new Date(now.getTime() + index * 1000) } });
  }
  stage = 'orden, búsqueda literal, filtros y páginas';
  const all = await request(app).get('/api/archivos').query({ buscar: runId.toUpperCase() });
  assert.equal(all.status, 200); assert.deepEqual(all.body.data.map((row: { id: string }) => row.id), [...ids].reverse());
  assert.equal(all.body.meta.total, 3);
  const filtered = await request(app).get('/api/archivos').query({ buscar: runId, categoria: 'pdf' });
  assert.deepEqual(filtered.body.data.map((row: { id: string }) => row.id), [ids[1]]);
  const page = await request(app).get('/api/archivos').query({ buscar: runId, pagina: 2, limite: 2 });
  assert.deepEqual(page.body.data.map((row: { id: string }) => row.id), [ids[0]]);
  assert.equal(page.body.meta.totalPaginas, 2);
  assert.equal((await request(app).get('/api/archivos').query({ buscar: `${runId} 100%_` })).body.meta.total, 1);
  assert.deepEqual((await request(app).get('/api/archivos').query({ buscar: runId, pagina: 5 })).body.data, []);

  stage = 'fallo cloud sin registro DB';
  failUpload = true;
  assert.equal((await post('fallo cloud')).status, 500);
  failUpload = false;
  assert.equal(await countOwn(), 3); assert.equal(remote.size, 3);

  stage = 'rechazo SQL real después de cloud y compensación';
  const invalidPersistence = { ...repository, create: (metadata: Parameters<typeof repository.create>[0]) => repository.create({ ...metadata, tamanoBytes: 0 }) };
  const failed = await post('restricción SQL', tinyPng(), 'foto.png', makeApp(invalidPersistence));
  assert.equal(failed.status, 500); assert.equal(failed.body.error.code, 'PERSISTENCE_FAILED');
  assert.equal(await countOwn(), 3); assert.equal(remote.size, 3);
  assert.equal(events.at(-1)?.phase, 'COMPENSATED');

  stage = 'DELETE correcto e idempotencia';
  assert.equal((await request(app).delete(`/api/archivos/${ids[1]}`)).status, 204);
  assert.equal(await db.activo.findUnique({ where: { id: ids[1] } }), null);
  assert.equal((await request(app).delete(`/api/archivos/${ids[1]}`)).status, 404);

  stage = 'fallo DELETE cloud conserva fila oculta y permite reintento';
  failCloudDelete = true;
  assert.equal((await request(app).delete(`/api/archivos/${ids[0]}`)).body.error.code, 'CLOUD_DELETE_FAILED');
  assert.equal((await db.activo.findUniqueOrThrow({ where: { id: ids[0] } })).estado, 'ERROR_BORRADO');
  assert.equal((await request(app).get('/api/archivos').query({ buscar: runId })).body.meta.total, 1);
  failCloudDelete = false;
  assert.equal((await request(app).delete(`/api/archivos/${ids[0]}`)).status, 204);

  stage = 'fallo DB final conserva NUBE_ELIMINADA y recupera sin repetir cloud';
  failRemove = true;
  assert.equal((await request(app).delete(`/api/archivos/${ids[2]}`)).body.error.code, 'DELETE_PENDING');
  assert.equal((await db.activo.findUniqueOrThrow({ where: { id: ids[2] } })).estado, 'NUBE_ELIMINADA');
  assert.equal(remote.size, 0);
  assert.equal((await request(app).delete(`/api/archivos/${ids[2]}`)).body.error.code, 'DELETE_IN_PROGRESS');
  failRemove = false; now = new Date(now.getTime() + DELETION_LEASE_MS + 1);
  const before = deleteCalls;
  assert.equal((await request(app).delete(`/api/archivos/${ids[2]}`)).status, 204);
  assert.equal(deleteCalls, before); assert.equal(await countOwn(), 0);

  stage = 'fallo al registrar resultado cloud y recuperación con already_absent';
  const interrupted = (await post('interrumpido')).body.data.id;
  failMark = true;
  assert.equal((await request(app).delete(`/api/archivos/${interrupted}`)).body.error.code, 'DELETE_PENDING');
  assert.equal((await db.activo.findUniqueOrThrow({ where: { id: interrupted } })).estado, 'ELIMINANDO');
  failMark = false; now = new Date(now.getTime() + DELETION_LEASE_MS + 1);
  assert.equal((await request(app).delete(`/api/archivos/${interrupted}`)).status, 204);

  stage = 'dos DELETE simultáneos reservan una única operación cloud';
  const concurrent = (await post('concurrencia')).body.data.id;
  let entered!: () => void, release!: () => void;
  const entering = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  beforeDelete = async () => { entered(); await gate; };
  const first = request(app).delete(`/api/archivos/${concurrent}`).then(response => response);
  try {
    await Promise.race([entering, first.then(() => { throw new Error('First request did not enter cloud'); })]);
    assert.equal((await request(app).delete(`/api/archivos/${concurrent}`)).body.error.code, 'DELETE_IN_PROGRESS');
  } finally { release(); beforeDelete = undefined; }
  assert.equal((await first).status, 204);

  stage = 'una respuesta tardía no modifica un intento nuevo';
  const fenced = (await post('reserva vencida')).body.data.id;
  const ticket1 = await store.claim(fenced); assert.equal(typeof ticket1, 'object');
  now = new Date(now.getTime() + DELETION_LEASE_MS + 1);
  const ticket2 = await store.claim(fenced); assert.equal(typeof ticket2, 'object');
  if (typeof ticket1 === 'string' || typeof ticket2 === 'string') throw new Error('Missing tickets');
  await assert.rejects(() => store.markCloudError(ticket1));
  await cloud.delete(ticket2); await store.markCloudRemoved(ticket2); await store.remove(ticket2);
  assert.equal(await countOwn(), 0); assert.equal(remote.size, 0);
  console.info('PASS: CRUD HTTP con PostgreSQL real, tres categorías, búsqueda/filtros/orden/paginación, compensación SQL, fallos entre proveedores, concurrencia y reintentos recuperables.');
} catch {
  console.error(`FAIL: ${stage}. Se omiten respuestas internas y credenciales.`);
  process.exitCode = 1;
} finally {
  if (database) {
    // Este gateway era simulado: solo existen filas propias en la DB separada.
    await database.activo.deleteMany({ where: { publicId: { startsWith: prefix } } }).catch(() => {
      console.error(`Limpieza pendiente del lote de prueba ${runId}.`); process.exitCode = 1;
    });
    await database.$disconnect().catch(() => { process.exitCode = 1; });
  }
}
