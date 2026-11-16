import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Library } from '../src/components/Library';
import { ApiError, createMediaApi, type AssetQuery } from '../src/lib/api';
import { assetFixture } from './fixtures';
import { readPendingDeletes } from '../src/lib/pending-deletes';
const full = { data: [assetFixture], meta: { pagina: 1, limite: 12, total: 1, totalPaginas: 1 } };
const empty = { data: [], meta: { pagina: 1, limite: 12, total: 0, totalPaginas: 0 } };
test('combina búsqueda y categoría, pagina y vuelve a la primera página al filtrar', async () => {
  const list = vi.fn().mockImplementation((query: AssetQuery) => Promise.resolve({ ...full, meta: { ...full.meta, pagina: query.pagina, total: 25, totalPaginas: 3 } }));
  render(<Library list={list} revision={0}/>);
  await screen.findByAltText(assetFixture.titulo);
  fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
  await waitFor(() => expect(list.mock.lastCall?.[0].pagina).toBe(2));
  fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
  await waitFor(() => expect(list.mock.lastCall?.[0]).toMatchObject({ pagina: 1, categoria: 'pdf' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'informe & guía' } });
  await waitFor(() => expect(list.mock.lastCall?.[0]).toMatchObject({ pagina: 1, categoria: 'pdf', buscar: 'informe & guía' }));
});
test('sin coincidencias permite limpiar filtros', async () => {
  const list = vi.fn().mockResolvedValue(empty); render(<Library list={list} revision={0}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Videos' }));
  await screen.findByText('No encontramos coincidencias');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(await screen.findByText('Tu próxima idea empieza aquí')).toBeTruthy();
});
test('confirmación enfoca conservar, permite cancelar y bloquea doble borrado', async () => {
  let finish!: () => void;
  const remove = vi.fn().mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const list = vi.fn().mockResolvedValueOnce(full).mockResolvedValue(empty);
  render(<Library list={list} remove={remove} revision={0}/>);
  fireEvent.click(await screen.findByRole('button', { name: `Eliminar ${assetFixture.titulo}` }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Conservar archivo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Conservar archivo' })); expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: `Eliminar ${assetFixture.titulo}` }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar archivo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminando…' })); expect(remove).toHaveBeenCalledOnce();
  expect(readPendingDeletes()[0].id).toBe(assetFixture.id);
  await act(async () => finish());
  expect(screen.queryByRole('article', { name: assetFixture.titulo })).toBeNull();
  expect(screen.getByText(/se eliminó de la biblioteca/)).toBeTruthy(); expect(readPendingDeletes()).toEqual([]);
});
test.each(['CLOUD_DELETE_FAILED', 'DELETE_PENDING'])('fallo %s refresca, conserva ID tras recargar y permite reintentar', async code => {
  const remove = vi.fn().mockRejectedValueOnce(new ApiError(code, 'Borrado pendiente.')).mockResolvedValue(undefined);
  const list = vi.fn().mockResolvedValueOnce(full).mockResolvedValue(empty);
  const view = render(<Library list={list} remove={remove} revision={0}/>);
  fireEvent.click(await screen.findByRole('button', { name: `Eliminar ${assetFixture.titulo}` }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar archivo' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Borrado pendiente.'));
  expect(screen.queryByText(/se eliminó de la biblioteca/)).toBeNull();
  expect(readPendingDeletes()[0].id).toBe(assetFixture.id);
  view.unmount(); render(<Library list={list} remove={remove} revision={0}/>);
  fireEvent.click(screen.getByRole('button', { name: `Reintentar borrado de ${assetFixture.titulo}` }));
  await waitFor(() => expect(screen.queryByLabelText('Borrados pendientes')).toBeNull());
  expect(remove.mock.calls.map(call => call[0])).toEqual([assetFixture.id, assetFixture.id]);
});
test('eliminar el último registro de una página vuelve a la anterior', async () => {
  let deleted = false;
  const list = vi.fn().mockImplementation((query: AssetQuery) => Promise.resolve({ data: deleted && query.pagina === 2 ? [] : [assetFixture], meta: { pagina: query.pagina, limite: 12, total: deleted ? 12 : 13, totalPaginas: deleted ? 1 : 2 } }));
  const remove = vi.fn(async () => { deleted = true; });
  render(<Library list={list} remove={remove} revision={0}/>);
  await screen.findByAltText(assetFixture.titulo); fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
  await screen.findByText('2 / 2');
  fireEvent.click(screen.getByRole('button', { name: `Eliminar ${assetFixture.titulo}` }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar archivo' }));
  expect(await screen.findByText('1 / 1')).toBeTruthy();
});
test('DELETE envía solo ID, acepta 204 vacío y 404 de activo; rechaza otros errores', async () => {
  const request = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'ASSET_NOT_FOUND' } }), { status: 404 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'secret' } }), { status: 404 }));
  const api = createMediaApi('https://api.test/api', undefined, request);
  await expect(api.remove(assetFixture.id, new AbortController().signal)).resolves.toBeUndefined();
  expect(request.mock.calls[0][0]).toBe(`https://api.test/api/archivos/${assetFixture.id}`);
  expect(request.mock.calls[0][1]).toMatchObject({ method: 'DELETE', credentials: 'omit' });
  expect(request.mock.calls[0][1].body).toBeUndefined();
  await expect(api.remove(assetFixture.id, new AbortController().signal)).resolves.toBeUndefined();
  await expect(api.remove(assetFixture.id, new AbortController().signal)).rejects.toMatchObject({ status: 404, code: 'HTTP_ERROR' });
});
