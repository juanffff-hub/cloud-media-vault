import { HttpError } from '../middleware/errors.js';
import type { PersistedAsset } from './asset-persistence.js';
import type { MediaCategory } from './cloud-storage.js';

export interface AssetQuery { buscar?: string; categoria?: MediaCategory; pagina: number; limite: number }
export interface AssetPage {
  data: PersistedAsset[];
  meta: { pagina: number; limite: number; total: number; totalPaginas: number };
}
export interface AssetListing { list(query: AssetQuery): Promise<AssetPage> }

export function parseAssetQuery(query: Record<string, unknown>): AssetQuery {
  const invalid = () => new HttpError(400, 'INVALID_QUERY', 'Revisa búsqueda, categoría y paginación.');
  if (Object.keys(query).some(key => !['buscar', 'categoria', 'pagina', 'limite'].includes(key)) ||
    Object.values(query).some(value => typeof value !== 'string')) throw invalid();
  const integer = (name: string, fallback: number, max: number) => {
    if (query[name] === undefined) return fallback;
    const raw = query[name] as string;
    if (!/^[1-9]\d*$/.test(raw) || Number(raw) > max) throw invalid();
    return Number(raw);
  };
  const buscar = (query.buscar as string | undefined)?.normalize('NFC').trim();
  if (buscar && (buscar.length > 160 || /[\x00-\x1f\x7f-\x9f]/.test(buscar))) throw invalid();
  if (query.categoria !== undefined && !['imagen', 'video', 'pdf'].includes(query.categoria as string)) throw invalid();
  return { buscar: buscar || undefined, categoria: query.categoria as MediaCategory | undefined,
    pagina: integer('pagina', 1, 10000), limite: integer('limite', 12, 50) };
}
