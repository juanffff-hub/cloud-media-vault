import { useEffect, useState } from 'react';
import { ApiError, type AssetPage, type ListAssets } from '../lib/api';
import { AssetCard } from './AssetCard';
import { Icon } from './Icon';
export function Library({ list, revision }: { list: ListAssets; revision: number }) {
  const [page, setPage] = useState<AssetPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    list({ pagina: 1, limite: 12 }, controller.signal).then(result => {
      if (!controller.signal.aborted) setPage(result);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.message : 'No pudimos cargar tu biblioteca. Vuelve a intentarlo.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [list, revision, retry]);
  return <section className="library" id="biblioteca" aria-labelledby="library-title">
    <div className="library-heading"><div><p className="eyebrow">TODO EN SU LUGAR</p><h2 id="library-title">Tu biblioteca <span className="count-badge">{page?.meta.total ?? '—'}</span></h2></div><button className="text-button" onClick={() => setRetry(value => value + 1)} disabled={loading}>Actualizar</button></div>
    <p className="library-caption">Los más recientes, primero.</p>
    {error ? <div className="library-state"><Icon name="file" size={34}/><h3>No pudimos conectar</h3><p role="alert">{error}</p><button className="button button-secondary" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> :
      loading ? <div className="library-state" role="status"><span className="spinner"/><p>Cargando tu biblioteca…</p></div> :
      !page?.data.length ? <div className="library-state empty-library"><span className="empty-icon"><Icon name="vault" size={34}/></span><h3>Tu próxima idea empieza aquí</h3><p>Sube tu primer archivo y dale un lugar en tu biblioteca.</p><a href="#subir" className="button button-secondary"><Icon name="upload" size={16}/>Añadir un archivo</a><small>Imágenes · Videos · PDF</small></div> :
      <div className="asset-grid">{page.data.map(asset => <AssetCard key={asset.id} asset={asset}/>)}</div>}
  </section>;
}
