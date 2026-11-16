import { test, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { readEnvironment } from '../../server/src/config/env';
import { createDatabase } from '../../server/src/adapters/database';
import { loadDatabaseTarget } from '../../server/scripts/database-env.mjs';
import { tinyPdf } from '../../server/test/media-fixtures';
import { landscapePng } from './demo-files';
import type { Asset } from '../src/lib/api';

test('React → Cloudinary → Neon: PNG, MP4, PDF y borrado desde la interfaz', async ({ page, request }, info) => {
  let stage = 'configuración';
  let database: ReturnType<typeof createDatabase> | undefined;
  let directory: string | undefined;
  const files = ['paisaje.png', 'movimiento.mp4', 'documento.pdf'];
  const created: Asset[] = [], deleted = new Set<string>();
  const errors: string[] = [], evidence: object[] = [];
  const runId = randomUUID();
  page.on('pageerror', () => errors.push('pageerror'));
  page.on('console', event => { if (event.type() === 'error') errors.push('console'); });
  try {
    const local = parse(await readFile(new URL('../../server/.env', import.meta.url)));
    const environment = readEnvironment({ ...local, ...process.env });
    assert.equal(environment.CLIENT_ORIGIN, 'http://127.0.0.1:5173'); assert.equal(environment.PORT, 3001);
    database = createDatabase(loadDatabaseTarget(false).databaseUrl);
    const credentials = { cloud_name: environment.CLOUDINARY_CLOUD_NAME, api_key: environment.CLOUDINARY_API_KEY, api_secret: environment.CLOUDINARY_API_SECRET, timeout: 20_000 };
    directory = await mkdtemp(join(tmpdir(), 'cloud-media-vault-ui-'));
    await writeFile(join(directory, files[0]), landscapePng()); await writeFile(join(directory, files[2]), tinyPdf());
    execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x507565:s=640x360:r=24',
      '-vf', 'drawbox=x=70:y=60:w=500:h=240:color=0xd9e5cb:t=3,drawbox=x=280:y=140:w=80:h=80:color=0xe7ecb8:t=fill', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(directory, files[1])], { windowsHide: true, timeout: 30_000, stdio: ['ignore', 'ignore', 'pipe'] });
    stage = 'salud y formulario';
    assert.equal((await request.get('http://127.0.0.1:3001/api/health', { timeout: 10_000 })).status(), 200);
    await page.goto('/');
    const names = ['Paisaje de prueba', 'Movimiento de prueba', 'Documento de prueba'];
    for (const [index, file] of files.entries()) {
      stage = `subida React de ${file}`;
      const title = `${names[index]} · ${runId.slice(0, 8)}`;
      await page.getByLabel(/Título/).fill(title); await page.getByLabel(/Autor/).fill('Juan David Ortiz Dcroz');
      await page.getByLabel(/^Archivo/).setInputFiles(join(directory, file));
      if (index === 0) await expect(page.getByAltText(`Vista previa de ${file}`)).toBeVisible();
      if (index === 1) await expect(page.getByLabel(`Vista previa de ${file}`)).toBeVisible();
      if (index === 2) await expect(page.getByRole('link', { name: 'Abrir vista previa del PDF' })).toBeVisible();
      const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/archivos'), { timeout: 90_000 });
      await page.getByRole('button', { name: 'Subir archivo', exact: true }).click();
      const response = await responsePromise; assert.equal(response.status(), 201);
      const asset = (await response.json()).data as Asset; created.push(asset);
      await expect(page.getByRole('article', { name: title })).toBeVisible();
      stage = `verificación cloud y Neon de ${file}`;
      const row = await database.activo.findUniqueOrThrow({ where: { id: asset.id } });
      assert.equal(row.titulo, title); assert.equal(row.subidoPor, 'Juan David Ortiz Dcroz'); assert.equal(row.nombreOriginal, file);
      assert.equal(row.secureUrl, asset.secureUrl); assert.equal(row.publicId, asset.publicId);
      assert.equal(row.resourceType, index === 1 ? 'video' : 'image'); assert.equal(row.categoria, ['imagen', 'video', 'pdf'][index]);
      assert.equal(row.mimeType, ['image/png', 'video/mp4', 'application/pdf'][index]); assert.equal(row.estado, 'ACTIVO');
      assert.equal(row.tamanoBytes, (await readFile(join(directory, file))).length); assert(row.fechaSubida instanceof Date);
      assert(row.publicId.startsWith('cloud-media-vault/'));
      const remote = await cloudinary.api.resource(row.publicId, { ...credentials, resource_type: row.resourceType });
      assert.equal(remote.public_id, row.publicId); assert.equal(remote.resource_type, row.resourceType);
      const delivery = await fetch(row.secureUrl, { signal: AbortSignal.timeout(20_000) }); assert.equal(delivery.status, 200);
      const bytes = Buffer.from(await delivery.arrayBuffer()); assert(bytes.length > 0);
      if (index === 0) await expect.poll(() => page.getByRole('article', { name: title }).locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      if (index === 1) await expect.poll(() => page.getByRole('article', { name: title }).locator('video').evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThan(0);
      if (index === 2) {
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
        await expect(page.getByRole('link', { name: `Abrir PDF: ${title}` })).toHaveAttribute('href', asset.secureUrl);
      }
      evidence.push({ archivo: file, id: asset.id, publicId: asset.publicId, resourceType: asset.resourceType, post: 201, cloud: 'confirmed', neon: 'confirmed', delivery: 200, react: 'visible' });
      console.info(`PASS: React POST ${file} 201; Cloudinary, Neon completo, vista y HTTPS 200.`);
    }
    stage = 'galería responsive y filtros reales';
    await page.getByRole('searchbox').fill(runId.slice(0, 8)); await expect(page.getByRole('article')).toHaveCount(3);
    await page.getByRole('button', { name: 'PDF', exact: true }).click(); await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: 'Todos', exact: true }).click(); await expect(page.getByRole('article')).toHaveCount(3);
    const video = page.getByRole('article', { name: created[1].titulo }).locator('video');
    await video.evaluate(async (element: HTMLVideoElement) => { await element.play(); });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(.2);
    await video.evaluate((element: HTMLVideoElement) => element.pause());
    await page.screenshot({ path: info.outputPath('desktop-real.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: info.outputPath('mobile-real.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1100 });
    for (const asset of created) {
      stage = `borrado React y ausencia de ${asset.categoria}`;
      await page.getByRole('button', { name: `Eliminar ${asset.titulo}`, exact: true }).click();
      if (asset.categoria === 'imagen') await page.screenshot({ path: info.outputPath('confirmacion-real.png') });
      const responsePromise = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith(`/archivos/${asset.id}`));
      await page.getByRole('button', { name: 'Eliminar archivo', exact: true }).click();
      assert.equal((await responsePromise).status(), 204);
      await expect(page.getByRole('article', { name: asset.titulo })).toHaveCount(0);
      assert.equal(await database.activo.findUnique({ where: { id: asset.id } }), null);
      let absent = false;
      try { await cloudinary.api.resource(asset.publicId, { ...credentials, resource_type: asset.resourceType }); }
      catch (error) { const result = error as { http_code?: number; error?: { http_code?: number } }; absent = (result.http_code ?? result.error?.http_code) === 404; }
      assert(absent); deleted.add(asset.id);
      console.info(`PASS: React DELETE ${asset.categoria} 204; galería actualizada, Cloudinary 404 y Neon sin fila.`);
    }
    assert.deepEqual(errors, []);
    await writeFile(info.outputPath('resultado.json'), JSON.stringify({ runId, date: new Date().toISOString(), evidence, deleted: [...deleted], consoleErrors: errors }, null, 2));
  } catch { throw new Error(`Prueba real detenida en: ${stage}. No se muestran datos internos ni credenciales.`); }
  finally {
    let cleanupFailed = false;
    for (const asset of created.filter(asset => !deleted.has(asset.id))) {
      try { const response = await request.delete(`http://127.0.0.1:3001/api/archivos/${asset.id}`, { timeout: 60_000 }); if (![204, 404].includes(response.status())) cleanupFailed = true; }
      catch { cleanupFailed = true; }
    }
    await database?.$disconnect().catch(() => { cleanupFailed = true; });
    if (directory) { for (const file of files) await unlink(join(directory, file)).catch(() => {}); await rmdir(directory).catch(() => { cleanupFailed = true; }); }
    if (cleanupFailed) throw new Error('Revisar la limpieza del lote de demo de esta ejecución; no tocar recursos ajenos.');
  }
});
