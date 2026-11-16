import type { MediaCategory, UploadDraft } from './files';

export interface Asset {
  id: string; titulo: string; nombreOriginal: string; secureUrl: string; publicId: string;
  resourceType: 'image' | 'video'; categoria: MediaCategory; mimeType: string; tamanoBytes: number;
  fechaSubida: string; subidoPor: string; estado: 'ACTIVO';
}
export interface UploadOptions { signal: AbortSignal; onProgress(percent: number | null, processing: boolean): void }
export type UploadFile = (draft: UploadDraft, options: UploadOptions) => Promise<Asset>;
export interface AssetQuery { buscar?: string; categoria?: MediaCategory; pagina?: number; limite?: number }
export interface AssetPage { data: Asset[]; meta: { pagina: number; limite: number; total: number; totalPaginas: number } }
export type ListAssets = (query: AssetQuery, signal: AbortSignal) => Promise<AssetPage>;
export type DeleteAsset = (id: string, signal: AbortSignal) => Promise<void>;
export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 0) { super(message); }
}
const messages: Record<string, string> = {
  FILE_TOO_LARGE: 'El archivo supera los 10 MB. Elige uno más pequeño.',
  INVALID_FILE: 'El contenido del archivo no coincide con un formato permitido. Elige otro.',
  INVALID_FORM: 'Revisa el título, el autor y el archivo antes de volver a intentar.',
  FILE_REQUIRED: 'Selecciona un archivo con contenido.',
  UPLOAD_BUSY: 'Hay otras cargas en curso. Inténtalo de nuevo en unos segundos.',
  CLOUD_UPLOAD_FAILED: 'No se pudo subir el archivo. Inténtalo de nuevo.',
  PERSISTENCE_FAILED: 'No se pudo guardar el archivo. Inténtalo de nuevo.',
  PERSISTENCE_UNCERTAIN: 'No se pudo confirmar el guardado. Revisa la biblioteca antes de volver a subir.',
  JOURNAL_UNAVAILABLE: 'No se pudo completar la carga. Inténtalo de nuevo.',
  CLOUD_DELETE_FAILED: 'No se pudo confirmar el borrado del archivo. Puedes reintentarlo.',
  DELETE_PENDING: 'El archivo ya no está disponible, pero falta cerrar el borrado. Espera cinco minutos y reintenta.',
  DELETE_IN_PROGRESS: 'El borrado sigue en curso. Espera cinco minutos antes de reintentar.',
  ASSET_NOT_FOUND: 'El archivo ya no está en la biblioteca.',
};
export function apiError(status: number, body: unknown): ApiError {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  const known = typeof code === 'string' && Object.hasOwn(messages, code);
  const fallback = status === 413 ? messages.FILE_TOO_LARGE : status === 400 ? messages.INVALID_FORM : 'No pudimos completar la operación. Inténtalo de nuevo.';
  return new ApiError(known ? code : 'HTTP_ERROR', known ? messages[code] : fallback, status);
}
export function parseAsset(value: unknown): Asset {
  const row = value as Partial<Asset> | null;
  let url: URL | undefined;
  try { url = new URL(row?.secureUrl ?? ''); } catch { /* No exponer la respuesta cruda. */ }
  if (!row || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id ?? '') ||
    !url || url.protocol !== 'https:' || url.username || url.password ||
    !['titulo', 'nombreOriginal', 'publicId', 'mimeType', 'subidoPor'].every(key => typeof row[key as keyof Asset] === 'string') ||
    !['imagen', 'video', 'pdf'].includes(row.categoria ?? '') ||
    row.resourceType !== (row.categoria === 'video' ? 'video' : 'image') || row.estado !== 'ACTIVO' ||
    !Number.isInteger(row.tamanoBytes) || row.tamanoBytes! <= 0 || row.tamanoBytes! > 10485760 ||
    typeof row.fechaSubida !== 'string' || !Number.isFinite(Date.parse(row.fechaSubida))) {
    throw new ApiError('INVALID_RESPONSE', 'No se pudo confirmar la respuesta. Revisa la biblioteca antes de repetir la operación.');
  }
  return row as Asset;
}
export function createMediaApi(baseUrl: string, xhrFactory = () => new XMLHttpRequest(), request: typeof fetch = (...args) => fetch(...args)) {
  const remove: DeleteAsset = async (id, signal) => {
    try {
      const response = await request(`${baseUrl}/archivos/${encodeURIComponent(id)}`, { method: 'DELETE', signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]), credentials: 'omit' });
      if (response.status === 204) return;
      const body = await response.json();
      if (response.status === 404 && body?.error?.code === 'ASSET_NOT_FOUND') return;
      throw apiError(response.status, body);
    } catch (error) {
      if (signal.aborted || error instanceof ApiError) throw error;
      throw new ApiError('NETWORK_ERROR', 'No se pudo confirmar el borrado. Comprueba la conexión y reintenta con este mismo archivo.');
    }
  };
  const list: ListAssets = async (query, signal) => {
    const params = new URLSearchParams({ pagina: String(query.pagina ?? 1), limite: String(query.limite ?? 12) });
    if (query.buscar?.trim()) params.set('buscar', query.buscar.trim());
    if (query.categoria) params.set('categoria', query.categoria);
    try {
      const response = await request(`${baseUrl}/archivos?${params}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), cache: 'no-store', credentials: 'omit' });
      const body = await response.json();
      if (!response.ok) throw apiError(response.status, body);
      const meta = body?.meta as AssetPage['meta'] | undefined;
      if (!Array.isArray(body?.data) || !meta || ![meta.pagina, meta.limite, meta.total, meta.totalPaginas].every(Number.isSafeInteger) ||
        meta.pagina < 1 || meta.limite < 1 || meta.limite > 50 || meta.total < 0 || meta.totalPaginas !== Math.ceil(meta.total / meta.limite) || body.data.length > meta.limite) {
        throw new ApiError('INVALID_RESPONSE', 'La biblioteca devolvió una respuesta incompleta. Vuelve a intentarlo.');
      }
      return { data: body.data.map(parseAsset), meta };
    } catch (error) {
      if (signal.aborted || error instanceof ApiError) throw error;
      throw new ApiError('NETWORK_ERROR', 'No pudimos cargar tu biblioteca. Comprueba la conexión y vuelve a intentarlo.');
    }
  };
  const upload: UploadFile = (draft, options) => new Promise((resolve, reject) => {
    if (options.signal.aborted) { reject(new ApiError('CANCELLED', 'La carga fue cancelada.')); return; }
    const xhr = xhrFactory();
    let settled = false;
    const finish = (error?: ApiError, asset?: Asset) => {
      if (settled) return;
      settled = true; options.signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(asset!);
    };
    const abort = () => xhr.abort();
    xhr.upload.addEventListener('progress', event => {
      if (!settled) options.onProgress(event.lengthComputable && event.total > 0 ? Math.min(100, Math.floor(event.loaded * 100 / event.total)) : null, false);
    });
    xhr.upload.addEventListener('load', () => { if (!settled) options.onProgress(100, true); });
    xhr.addEventListener('load', () => {
      let body: unknown;
      try { body = JSON.parse(xhr.responseText); } catch { /* La respuesta inválida se maneja sin reflejarla. */ }
      if (xhr.status !== 201) { finish(apiError(xhr.status, body)); return; }
      try { finish(undefined, parseAsset((body as { data?: unknown })?.data)); }
      catch (error) { finish(error as ApiError); }
    });
    xhr.addEventListener('error', () => finish(new ApiError('NETWORK_ERROR', 'Se perdió la conexión. Revisa la biblioteca antes de volver a subir.')));
    xhr.addEventListener('timeout', () => finish(new ApiError('TIMEOUT', 'La carga tardó demasiado. Revisa la biblioteca antes de volver a subir.')));
    xhr.addEventListener('abort', () => finish(new ApiError('CANCELLED', 'La carga fue cancelada.')));
    options.signal.addEventListener('abort', abort, { once: true });
    try {
      xhr.open('POST', `${baseUrl}/archivos`);
      xhr.timeout = 240_000;
      const form = new FormData();
      form.append('titulo', draft.titulo); form.append('subidoPor', draft.subidoPor); form.append('archivo', draft.archivo);
      // El navegador crea Content-Type y boundary; nunca se incluyen credenciales cloud.
      if (options.signal.aborted) { finish(new ApiError('CANCELLED', 'La carga fue cancelada.')); return; }
      xhr.send(form);
    } catch { finish(new ApiError('NETWORK_ERROR', 'No se pudo iniciar la carga. Comprueba tu conexión.')); }
  });
  return { upload, list, remove };
}
