import { test, expect, type Page } from '@playwright/test';
import { assetFixture } from '../test/fixtures';
import { tinyPng } from '../../server/test/media-fixtures';
async function mockLibrary(page: Page, initial = 14) {
  let assets = Array.from({ length: initial }, (_, index) => ({ ...assetFixture, id: `83a5f72d-5b33-412c-a730-${String(index).padStart(12, '0')}`, titulo: `Fotografía ${String(index + 1).padStart(2, '0')}` }));
  await page.route('https://res.cloudinary.com/**', route => route.fulfill({ contentType: 'image/png', body: tinyPng() }));
  await page.route('**/api/archivos**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() === 'DELETE') { assets = assets.filter(asset => asset.id !== url.pathname.split('/').at(-1)); return route.fulfill({ status: 204, headers }); }
    if (request.method() === 'POST') { assets.unshift(assetFixture); return route.fulfill({ status: 201, headers, json: { data: assetFixture } }); }
    const data = assets.filter(asset => (!url.searchParams.get('buscar') || asset.titulo.toLowerCase().includes(url.searchParams.get('buscar')!.toLowerCase())) && (!url.searchParams.get('categoria') || asset.categoria === url.searchParams.get('categoria')));
    const pagina = Number(url.searchParams.get('pagina') ?? 1), limite = 12;
    return route.fulfill({ headers, json: { data: data.slice((pagina - 1) * limite, pagina * limite), meta: { pagina, limite, total: data.length, totalPaginas: Math.ceil(data.length / limite) } } });
  });
}
test('biblioteca responsive, filtros, paginación y borrado confirmado sin errores', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', () => errors.push('pageerror')); page.on('console', event => { if (event.type() === 'error') errors.push('console'); });
  await mockLibrary(page); await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(12);
  await expect(page.getByText('1 / 2')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Página siguiente' }).click(); await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'PDF', exact: true }).click(); await expect(page.getByText('No encontramos coincidencias')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await page.getByRole('searchbox').fill('Fotografía 01'); await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Eliminar Fotografía 01', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Conservar archivo' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Eliminar Fotografía 01', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar archivo', exact: true }).click();
  await expect(page.getByText('«Fotografía 01» se eliminó de la biblioteca.')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0); expect(errors).toEqual([]);
});
test('formulario por teclado, selección, vista previa y subida reactiva', async ({ page }) => {
  await mockLibrary(page, 0); await page.goto('/');
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.getByRole('button', { name: 'Subir archivo', exact: true }).click();
  await expect(page.getByLabel(/Título/)).toBeFocused();
  await page.getByLabel(/Título/).fill('Mi fotografía'); await page.getByLabel(/Autor/).fill('Juan');
  await page.getByLabel(/^Archivo/).setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: tinyPng() });
  await expect(page.getByAltText('Vista previa de foto.png')).toBeVisible();
  await page.getByRole('button', { name: 'Subir archivo', exact: true }).click();
  await expect(page.getByText('«Mi fotografía» ya está en tu biblioteca.')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Mi fotografía' })).toBeVisible();
  await expect(page.getByLabel(/Título/)).toHaveValue('');
});
test('arrastrar archivo y límite local de 10 MB', async ({ page }) => {
  await mockLibrary(page, 0); await page.goto('/');
  const transfer = await page.evaluateHandle(bytes => { const data = new DataTransfer(); data.items.add(new File([new Uint8Array(bytes)], 'arrastrada.png', { type: 'image/png' })); return data; }, [...tinyPng()]);
  await page.getByRole('group', { name: 'Zona para arrastrar archivo' }).dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByAltText('Vista previa de arrastrada.png')).toBeVisible(); await transfer.dispose();
  await page.getByLabel(/^Archivo/).setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(10_485_761) });
  await expect(page.getByRole('alert')).toContainText('10 MB');
  await expect(page.getByAltText('Vista previa de arrastrada.png')).toHaveCount(0);
});
