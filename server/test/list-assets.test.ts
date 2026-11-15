import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { healthyProbe } from './fixtures.js';
import { createAssetRepository } from '../src/adapters/asset-repository.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

function setup() {
  const list = vi.fn().mockResolvedValue({ data: [], meta: { pagina: 1, limite: 12, total: 0, totalPaginas: 0 } });
  return { list, app: createApp({ CLIENT_ORIGIN: 'http://127.0.0.1:5173' }, healthyProbe, { list: { list } }) };
}

test('GET devuelve listado vacío, paginación y no permite caché', async () => {
  const { app, list } = setup();
  const response = await request(app).get('/api/archivos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [], meta: { pagina: 1, limite: 12, total: 0, totalPaginas: 0 } });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(list).toHaveBeenCalledWith({ buscar: undefined, categoria: undefined, pagina: 1, limite: 12 });
});

test('GET combina búsqueda normalizada, categoría y paginación', async () => {
  const { app, list } = setup();
  expect((await request(app).get('/api/archivos').query({ buscar: '  Informe  ', categoria: 'pdf', pagina: 2, limite: 5 })).status).toBe(200);
  expect(list).toHaveBeenCalledWith({ buscar: 'Informe', categoria: 'pdf', pagina: 2, limite: 5 });
});

test.each(['pagina=0', 'pagina=-1', 'pagina=1.5', 'pagina=10001', 'limite=51', 'limite=0',
  'categoria=audio', 'categoria=', 'pagina=1&pagina=2', 'buscar[x]=a', 'orden=asc', 'buscar=' + 'a'.repeat(161), 'buscar=%00a'])
('GET rechaza parámetros inválidos: %s', async query => {
  const { app, list } = setup();
  const response = await request(app).get(`/api/archivos?${query}`);
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('INVALID_QUERY');
  expect(list).not.toHaveBeenCalled();
});

test('GET no expone errores de PostgreSQL', async () => {
  const { app, list } = setup();
  list.mockRejectedValue(new Error('private-connection-string'));
  const response = await request(app).get('/api/archivos');
  expect(response.status).toBe(500);
  expect(response.text).not.toContain('private-connection-string');
});

test('consulta únicamente activos, con orden estable, literal LIKE y snapshot consistente', async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(21);
  const transaction = vi.fn(async (operation: (tx: unknown) => unknown) => operation({ activo: { findMany, count } }));
  const database = { $transaction: transaction } as unknown as PrismaClient;
  const page = await createAssetRepository(database).list({ buscar: '100%_\\', categoria: 'imagen', pagina: 2, limite: 10 });
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { estado: 'ACTIVO', categoria: 'imagen', titulo: { contains: '100\\%\\_\\\\', mode: 'insensitive' } },
    orderBy: [{ fechaSubida: 'desc' }, { id: 'desc' }], skip: 10, take: 10,
  }));
  expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
  expect(page.meta).toEqual({ pagina: 2, limite: 10, total: 21, totalPaginas: 3 });
});
