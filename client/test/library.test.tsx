import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Library } from '../src/components/Library';
import { AssetCard } from '../src/components/AssetCard';
import { type AssetPage, createMediaApi } from '../src/lib/api';
import { assetFixture } from './fixtures';
export const pageFixture: AssetPage = { data: [assetFixture], meta: { pagina: 1, limite: 12, total: 1, totalPaginas: 1 } };
test('galería muestra imagen, video con controles, enlace PDF y metadatos', async () => {
  const data = [assetFixture, { ...assetFixture, id: 'video', categoria: 'video', titulo: 'Mi clip' }, { ...assetFixture, id: 'pdf', categoria: 'pdf', titulo: 'Mi documento' }];
  const list = vi.fn().mockResolvedValue({ data, meta: { ...pageFixture.meta, total: 3 } });
  render(<Library list={list} revision={0}/>);
  expect(screen.getByRole('status').textContent).toContain('Cargando');
  expect(await screen.findByAltText('Mi fotografía')).toBeTruthy();
  expect((screen.getByLabelText('Video: Mi clip') as HTMLVideoElement).controls).toBe(true);
  expect(screen.getByRole('link', { name: 'Abrir PDF: Mi documento' }).getAttribute('rel')).toContain('noopener');
  expect(screen.getAllByText('Por Juan')).toHaveLength(3); expect(screen.getAllByText('image/png')).toHaveLength(3);
  expect(screen.getAllByText(/16.*nov.*2026/)).toHaveLength(3);
});
test('fallo de previsualización conserva un enlace funcional', () => {
  render(<AssetCard asset={assetFixture}/>);
  fireEvent.error(screen.getByAltText(assetFixture.titulo));
  expect(screen.getByText('Vista previa no disponible')).toBeTruthy();
  expect(screen.getByRole('link', { name: `Abrir ${assetFixture.titulo}` }).getAttribute('href')).toBe(assetFixture.secureUrl);
});
test('error permite reintentar y un listado vacío invita a subir', async () => {
  const list = vi.fn().mockRejectedValueOnce(new Error('internal')).mockResolvedValue({ data: [], meta: { ...pageFixture.meta, total: 0, totalPaginas: 0 } });
  render(<Library list={list} revision={0}/>); expect((await screen.findByRole('alert')).textContent).not.toContain('internal');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Tu próxima idea empieza aquí')).toBeTruthy();
});
test('una subida refresca la biblioteca e ignora una respuesta anterior tardía', async () => {
  let first!: (value: AssetPage) => void;
  const list = vi.fn().mockImplementationOnce(() => new Promise(resolve => { first = resolve; })).mockResolvedValue(pageFixture);
  const view = render(<Library list={list} revision={0}/>);
  view.rerender(<Library list={list} revision={1}/>);
  expect(await screen.findByAltText(assetFixture.titulo)).toBeTruthy();
  await act(async () => first({ data: [], meta: { ...pageFixture.meta, total: 0, totalPaginas: 0 } }));
  expect(screen.getByAltText(assetFixture.titulo)).toBeTruthy();
  expect(list.mock.calls[0][1].aborted).toBe(true);
});
test('GET codifica filtros, omite credenciales y valida paginación y URLs', async () => {
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(pageFixture), { status: 200 }));
  const api = createMediaApi('https://api.test/api', undefined, request);
  expect(await api.list({ buscar: 'A & B', categoria: 'pdf', pagina: 2 }, new AbortController().signal)).toEqual(pageFixture);
  const url = new URL(request.mock.calls[0][0]); expect(url.searchParams.get('buscar')).toBe('A & B'); expect(url.searchParams.get('pagina')).toBe('2');
  expect(request.mock.calls[0][1].credentials).toBe('omit');
  request.mockResolvedValue(new Response(JSON.stringify({ ...pageFixture, meta: { ...pageFixture.meta, total: -1 } })));
  await expect(api.list({}, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
