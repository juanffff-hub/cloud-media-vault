import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { readEnvironment } from '../../src/config/env.js';
import { createCloudinaryStorage } from '../../src/adapters/cloudinary.js';
import { createUploadJournal } from '../../src/adapters/upload-journal.js';
import { validateUpload } from '../../src/services/validate-upload.js';
import type { CloudReference } from '../../src/services/cloud-storage.js';
import { multerFile, tinyPng, tinyPdf } from '../media-fixtures.js';

loadDotenv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
let directory: string | undefined;
let stage = 'configuración';
const filenames = ['prueba.png', 'prueba.jpg', 'prueba.webp', 'prueba.mp4', 'prueba.webm', 'prueba.pdf'];

function providerStatus(error: unknown): number | undefined {
  const value = error as { http_code?: number; error?: { http_code?: number } } | null;
  return value?.http_code ?? value?.error?.http_code;
}

try {
  const environment = readEnvironment(process.env);
  const config = { ...environment, CLOUDINARY_FOLDER: `${environment.CLOUDINARY_FOLDER}/tests/part-2` };
  const storage = createCloudinaryStorage(config);
  const journal = createUploadJournal();
  const credentials = { cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET, timeout: config.CLOUDINARY_TIMEOUT_MS };
  directory = await mkdtemp(join(tmpdir(), 'cloud-media-vault-live-'));
  stage = 'generación de archivos propios (requiere FFmpeg)';
  await writeFile(join(directory, 'prueba.png'), tinyPng());
  await writeFile(join(directory, 'prueba.pdf'), tinyPdf());
  const ffmpeg = process.argv[2] || process.env.FFMPEG_PATH || 'ffmpeg';
  const run = (args: string[]) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args],
    { windowsHide: true, timeout: 30_000, stdio: ['ignore', 'ignore', 'pipe'] });
  run(['-i', join(directory, 'prueba.png'), '-frames:v', '1', join(directory, 'prueba.jpg')]);
  run(['-i', join(directory, 'prueba.png'), '-frames:v', '1', '-c:v', 'libwebp', join(directory, 'prueba.webp')]);
  const videoInput = ['-f', 'lavfi', '-i', 'color=c=green:s=64x64:r=10', '-t', '0.4'];
  run([...videoInput, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(directory, 'prueba.mp4')]);
  run([...videoInput, '-c:v', 'libvpx-vp9', join(directory, 'prueba.webm')]);

  const mimes = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf'];
  for (const [index, filename] of filenames.entries()) {
    const operationId = randomUUID();
    const attempt: { reference?: CloudReference; confirmed: boolean } = { confirmed: false };
    stage = `validación y subida de ${filename}`;
    try {
      const buffer = await readFile(join(directory, filename));
      const input = await validateUpload({ titulo: `Prueba Parte 2 ${filename}`, subidoPor: 'David Neira Conde' }, multerFile(buffer, filename, mimes[index]));
      const asset = await storage.upload({ buffer: input.buffer, category: input.categoria,
        onPrepared: async reference => {
          await journal.append({ ...reference, operationId, phase: 'PREPARED' });
          attempt.reference = reference;
        },
      });
      attempt.confirmed = true;
      attempt.reference = { publicId: asset.publicId, resourceType: asset.resourceType };
      await journal.append({ ...attempt.reference, operationId, phase: 'UPLOAD_CONFIRMED' });
      assert.equal(asset.resourceType, input.resourceType);
      stage = `lectura del proveedor y entrega HTTPS de ${filename}`;
      const remote = await cloudinary.api.resource(asset.publicId, { ...credentials, resource_type: asset.resourceType });
      assert.equal(remote.public_id, asset.publicId);
      assert.equal(remote.resource_type, input.resourceType);
      const delivery = await fetch(asset.secureUrl, { signal: AbortSignal.timeout(15_000) });
      if (!delivery.ok && input.categoria === 'pdf') {
        console.error(`PDF_DELIVERY_BLOCKED: HTTP ${delivery.status}. Revisar Settings > Security > Allow delivery of PDF and ZIP files.`);
      }
      assert.equal(delivery.status, 200);
      const delivered = Buffer.from(await delivery.arrayBuffer());
      assert(delivered.length > 0);
      if (input.categoria === 'pdf') assert(delivered.subarray(0, 5).equals(Buffer.from('%PDF-')));
      console.info(`PASS: ${filename}, ${asset.resourceType}, ${asset.bytes} bytes, proveedor y URL HTTPS verificados.`);
    } finally {
      if (attempt.reference) {
        const operationStage = stage;
        stage = `limpieza cloud de ${filename}`;
        try {
          const result = await storage.delete(attempt.reference);
          assert(['deleted', 'already_absent'].includes(result));
          let absent = false;
          try { await cloudinary.api.resource(attempt.reference.publicId, { ...credentials, resource_type: attempt.reference.resourceType }); }
          catch (error) { absent = providerStatus(error) === 404; }
          assert(absent, 'No se confirmó ausencia en el proveedor.');
          await journal.append({ ...attempt.reference, operationId,
            phase: attempt.confirmed ? 'COMPENSATED' : 'RECONCILIATION_REQUIRED', reasonCode: 'TEST_CLEANUP' });
          console.info(`PASS: limpieza confirmada de ${filename}.`);
          stage = operationStage;
        } catch {
          await journal.append({ ...attempt.reference, operationId, phase: 'RECONCILIATION_REQUIRED', reasonCode: 'TEST_CLEANUP' });
          console.error('Limpieza pendiente; consultar server/var/upload-journal.jsonl.');
          throw new Error('Cloud cleanup failed');
        }
      }
    }
  }
  console.info('PASS: seis formatos reales verificados y eliminados. No se escribieron registros en PostgreSQL.');
} catch {
  console.error(`FAIL: ${stage}. No se muestran credenciales ni respuestas internas.`);
  process.exitCode = 1;
} finally {
  if (directory) {
    for (const name of filenames) await unlink(join(directory, name)).catch(() => {});
    await rmdir(directory).catch(() => { console.error('No se pudo retirar la carpeta temporal de esta prueba.'); process.exitCode = 1; });
  }
}
