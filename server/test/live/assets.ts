import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import request from 'supertest';
import { readEnvironment } from '../../src/config/env.js';
import { createDatabase, checkDatabase } from '../../src/adapters/database.js';
import { createAssetRepository } from '../../src/adapters/asset-repository.js';
import { createDeletionRepository } from '../../src/adapters/deletion-repository.js';
import { createCloudinaryStorage } from '../../src/adapters/cloudinary.js';
import { createUploadJournal, readUploadJournal } from '../../src/adapters/upload-journal.js';
import { createDeleteAsset } from '../../src/services/delete-asset.js';
import { createHealthCheck } from '../../src/services/health.js';
import type { CloudReference, CloudStorage } from '../../src/services/cloud-storage.js';
import { loadDatabaseTarget } from '../../scripts/database-env.mjs';
import { createApp } from '../../src/app.js';
import { tinyPng, tinyPdf } from '../media-fixtures.js';

loadDotenv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const runId = randomUUID();
const journalPath = fileURLToPath(new URL(`../../var/live-part-3-${runId}.jsonl`, import.meta.url));
const journal = createUploadJournal(journalPath);
const pending = new Map<string, CloudReference>();
let directory: string | undefined, database: ReturnType<typeof createDatabase> | undefined;
let storage: CloudStorage | undefined;
let stage = 'configuración';
const names = ['prueba.png', 'prueba.mp4', 'prueba.pdf'];

function status(error: unknown): number | undefined {
  const value = error as { http_code?: number; error?: { http_code?: number } } | null;
  return value?.http_code ?? value?.error?.http_code;
}

try {
  const environment = readEnvironment(process.env);
  const config = { ...environment, CLOUDINARY_FOLDER: `${environment.CLOUDINARY_FOLDER}/tests/part-3/${runId}` };
  const db = database = createDatabase(loadDatabaseTarget(true).databaseUrl);
  const repository = createAssetRepository(db);
  const provider = storage = createCloudinaryStorage(config);
  const cloud: CloudStorage = { delete: reference => provider.delete(reference), upload: input => provider.upload({ ...input,
    onPrepared: async reference => { await input.onPrepared?.(reference); pending.set(reference.publicId, reference); } }) };
  const credentials = { cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET, timeout: config.CLOUDINARY_TIMEOUT_MS };
  const app = createApp(config, createHealthCheck(() => checkDatabase(db)), { upload: { persistence: repository, cloud, journal },
    list: repository, remove: createDeleteAsset(createDeletionRepository(db), cloud) });
  stage = 'generación de archivos originales';
  directory = await mkdtemp(join(tmpdir(), 'cloud-media-vault-crud-'));
  await writeFile(join(directory, names[0]), tinyPng());
  await writeFile(join(directory, names[2]), tinyPdf());
  execFileSync(process.argv[2] || process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=10', '-t', '0.4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', join(directory, names[1])], { windowsHide: true, timeout: 30_000, stdio: ['ignore', 'ignore', 'pipe'] });

  const ids: string[] = [];
  const types = ['image', 'video', 'image'];
  const categories = ['imagen', 'video', 'pdf'];
  const mimes = ['image/png', 'video/mp4', 'application/pdf'];
  for (const [index, name] of names.entries()) {
    stage = `POST real y verificación de ${name}`;
    const bytes: Buffer = await readFile(join(directory, name));
    const response = await request(app).post('/api/archivos').field('titulo', `${runId} ${name}`)
      .field('subidoPor', 'Juan Sebastian Gomez Muñoz').attach('archivo', bytes, { filename: name, contentType: mimes[index] });
    assert.equal(response.status, 201);
    const row = await db.activo.findUniqueOrThrow({ where: { id: response.body.data.id } });
    ids.push(row.id);
    assert.equal(row.secureUrl, response.body.data.secureUrl); assert.equal(row.estado, 'ACTIVO');
    assert.equal(row.resourceType, types[index]); assert.equal(row.categoria, categories[index]);
    assert.equal(row.mimeType, mimes[index]); assert.equal(row.nombreOriginal, name);
    assert.equal(row.tamanoBytes, bytes.length); assert(row.fechaSubida instanceof Date);
    assert.equal(row.subidoPor, 'Juan Sebastian Gomez Muñoz');
    assert(row.publicId.startsWith(`${config.CLOUDINARY_FOLDER}/`));
    const remote = await cloudinary.api.resource(row.publicId, { ...credentials, resource_type: row.resourceType });
    assert.equal(remote.public_id, row.publicId); assert.equal(remote.resource_type, types[index]);
    const delivery = await fetch(row.secureUrl, { signal: AbortSignal.timeout(15_000) });
    if (!delivery.ok && index === 2) console.error(`PDF_DELIVERY_BLOCKED: HTTP ${delivery.status}. Revisar Security > Allow delivery of PDF and ZIP files.`);
    assert.equal(delivery.status, 200);
    const delivered = Buffer.from(await delivery.arrayBuffer()); assert(delivered.length > 0);
    if (index === 2) assert(delivered.subarray(0, 5).equals(Buffer.from('%PDF-')));
    console.info(`PASS: POST ${name} 201; Cloudinary ${row.resourceType}, registro Neon completo y entrega HTTPS 200.`);
  }
  stage = 'GET real con búsqueda, filtro y paginación';
  const page = await request(app).get('/api/archivos').query({ buscar: runId, limite: 2 });
  assert.equal(page.status, 200); assert.equal(page.body.meta.total, 3); assert.equal(page.body.data.length, 2);
  const pdf = await request(app).get('/api/archivos').query({ buscar: runId, categoria: 'pdf' });
  assert.equal(pdf.body.meta.total, 1); assert.equal(pdf.body.data[0].id, ids[2]);
  console.info('PASS: GET real, búsqueda, filtro PDF y paginación.');

  for (const [index, id] of ids.entries()) {
    stage = `DELETE real y ausencia en ambos proveedores de ${names[index]}`;
    const row = await db.activo.findUniqueOrThrow({ where: { id } });
    const response = await request(app).delete(`/api/archivos/${id}`);
    assert.equal(response.status, 204);
    assert.equal(await db.activo.findUnique({ where: { id } }), null);
    let absent = false;
    try { await cloudinary.api.resource(row.publicId, { ...credentials, resource_type: row.resourceType }); }
    catch (error) { absent = status(error) === 404; }
    assert(absent);
    pending.delete(row.publicId);
    console.info(`PASS: DELETE ${names[index]} 204; ausencia confirmada en Cloudinary y Neon.`);
  }
  assert.equal((await request(app).get('/api/archivos').query({ buscar: runId })).body.meta.total, 0);
  console.info('PASS: flujo real completo con tres categorías; recursos y registros propios eliminados.');
} catch {
  console.error(`FAIL: ${stage}. No se muestran credenciales ni respuestas internas.`);
  process.exitCode = 1;
} finally {
  for (const reference of pending.values()) {
    try {
      if (!storage || !database) throw new Error('Cleanup unavailable');
      const result = await storage.delete(reference);
      assert(['deleted', 'already_absent'].includes(result));
      await database.activo.deleteMany({ where: { publicId: reference.publicId, resourceType: reference.resourceType } });
      const event = (await readUploadJournal(journalPath)).find(event => event.publicId === reference.publicId);
      if (event) await journal.append({ ...reference, operationId: event.operationId, phase: 'COMPENSATED', reasonCode: 'TEST_CLEANUP' });
      console.info('Limpieza de contingencia confirmada para un recurso de esta prueba.');
    } catch {
      console.error(`Limpieza pendiente en diario local live-part-3-${runId}.jsonl. Revisar este lote en la DB de prueba.`);
      process.exitCode = 1;
    }
  }
  await database?.$disconnect().catch(() => { process.exitCode = 1; });
  if (directory) {
    for (const name of names) await unlink(join(directory, name)).catch(() => {});
    await rmdir(directory).catch(() => { console.error('No se pudo retirar la carpeta temporal propia.'); process.exitCode = 1; });
  }
}
