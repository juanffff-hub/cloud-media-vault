export interface PendingDelete { id: string; titulo: string; message: string }
const key = 'cloud-media-vault:pending-deletes:v1';
export function readPendingDeletes(): PendingDelete[] {
  try {
    const rows: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => typeof row?.id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id) && typeof row.titulo === 'string').slice(0, 50)
      .map(row => ({ id: row.id, titulo: row.titulo.slice(0, 160), message: 'No se confirmó el borrado anterior. Reintenta con este mismo archivo.' }));
  } catch { return []; }
}
export function savePendingDeletes(rows: PendingDelete[]) {
  try { sessionStorage.setItem(key, JSON.stringify(rows.map(({ id, titulo }) => ({ id, titulo })))); }
  catch { /* La API también conserva las operaciones pendientes para recuperación. */ }
}
