import { useEffect, useRef, useState } from 'react';
import { ApiError, type AssetPage, type AssetQuery, type DeleteAsset, type ListAssets } from '../lib/api';
import { readPendingDeletes, savePendingDeletes } from '../lib/pending-deletes';
import { AssetCard } from './AssetCard';
import { DeleteDialog } from './DeleteDialog';
import { Icon } from './Icon';
const categories = [{ value: undefined, label: 'Todos' }, { value: 'imagen', label: 'Imágenes' }, { value: 'video', label: 'Videos' }, { value: 'pdf', label: 'PDF' }] as const;
export function Library({ list, remove, revision }: { list: ListAssets; remove?: DeleteAsset; revision: number }) {
  const [page, setPage] = useState<AssetPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<AssetQuery>({ buscar: '', pagina: 1, limite: 12 });
  const [selected, setSelected] = useState<{ id: string; titulo: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(readPendingDeletes);
  const request = useRef<AbortController | null>(null);
  const deletion = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; deletion.current?.abort(); }; }, []);
  useEffect(() => { savePendingDeletes(pending); }, [pending]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(previous => previous.buscar === search.trim() ? previous : { ...previous, buscar: search.trim(), pagina: 1 }), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => { setQuery(previous => previous.pagina === 1 ? previous : { ...previous, pagina: 1 }); }, [revision]);
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    list(query, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      // Un borrado puede dejar vacía la última página; vuelve a la última válida.
      if (result.meta.pagina > Math.max(1, result.meta.totalPaginas)) {
        setQuery(previous => ({ ...previous, pagina: Math.max(1, result.meta.totalPaginas) })); return;
      }
      setPage(result);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.message : 'No pudimos cargar tu biblioteca. Vuelve a intentarlo.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [list, query, revision, retry]);
  const erase = async (target: { id: string; titulo: string }) => {
    if (!remove || deletion.current) return;
    const controller = new AbortController(); deletion.current = controller;
    setDeleting(true); setNotice(''); request.current?.abort();
    // Conserva el ID antes de pedir el borrado, también si se recarga la pestaña.
    const nextPending = [...pending.filter(row => row.id !== target.id), { ...target, message: 'Borrado pendiente de confirmación.' }];
    savePendingDeletes(nextPending); setPending(nextPending);
    try {
      await remove(target.id, controller.signal);
      if (!mounted.current) return;
      setPage(previous => previous ? { ...previous, data: previous.data.filter(asset => asset.id !== target.id), meta: { ...previous.meta, total: Math.max(0, previous.meta.total - Number(previous.data.some(asset => asset.id === target.id))) } } : previous);
      setPending(previous => previous.filter(row => row.id !== target.id));
      setNotice(`«${target.titulo}» se eliminó de la biblioteca.`);
    } catch (reason) {
      if (!mounted.current) return;
      const message = reason instanceof ApiError ? reason.message : 'No se pudo confirmar el borrado. Reintenta con este mismo archivo.';
      setPending(previous => previous.map(row => row.id === target.id ? { ...row, message } : row));
    } finally {
      deletion.current = null;
      if (mounted.current) { setDeleting(false); setSelected(null); setRetry(value => value + 1); }
    }
  };
  const filtered = Boolean(query.buscar || query.categoria);
  const resetFilters = () => { setSearch(''); setQuery({ buscar: '', pagina: 1, limite: 12 }); };
  return <section className="library" id="biblioteca" aria-labelledby="library-title">
    <div className="library-heading"><div><p className="eyebrow">TODO EN SU LUGAR</p><h2 id="library-title">Tu biblioteca <span className="count-badge">{page?.meta.total ?? '—'}</span></h2></div><button className="text-button" onClick={() => setRetry(value => value + 1)} disabled={loading || deleting}>Actualizar</button></div>
    <p className="library-caption">Los más recientes, primero.</p>
    <div className="library-tools"><div className="category-filters" role="group" aria-label="Filtrar por categoría">{categories.map(category => <button key={category.label} aria-pressed={query.categoria === category.value} onClick={() => setQuery(previous => ({ ...previous, categoria: category.value, pagina: 1 }))}>{category.label}</button>)}</div>
      <label className="search-box"><Icon name="search" size={17}/><span className="visually-hidden">Buscar por título</span><input type="search" value={search} maxLength={160} placeholder="Buscar por título…" onChange={event => setSearch(event.target.value)}/></label></div>
    {notice && <p className="feedback feedback-success" role="status"><Icon name="check" size={16}/>{notice}</p>}
    {pending.length > 0 && <div className="pending-deletes" aria-label="Borrados pendientes">{pending.map(item => <div key={item.id}><p role="alert"><strong>{item.titulo}</strong> — {item.message}</p><button className="button button-secondary" disabled={deleting} onClick={() => void erase(item)}>Reintentar borrado de {item.titulo}</button></div>)}</div>}
    {error ? <div className="library-state"><Icon name="file" size={34}/><h3>No pudimos conectar</h3><p role="alert">{error}</p><button className="button button-secondary" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> :
      loading ? <div className="library-state" role="status"><span className="spinner"/><p>Cargando tu biblioteca…</p></div> :
      !page?.data.length ? <div className="library-state empty-library"><span className="empty-icon"><Icon name={filtered ? 'search' : 'vault'} size={34}/></span><h3>{filtered ? 'No encontramos coincidencias' : 'Tu próxima idea empieza aquí'}</h3><p>{filtered ? 'Prueba otro título o amplía los filtros.' : 'Sube tu primer archivo y dale un lugar en tu biblioteca.'}</p>{filtered ? <button className="button button-secondary" onClick={resetFilters}>Limpiar filtros</button> : <><a href="#subir" className="button button-secondary"><Icon name="upload" size={16}/>Añadir un archivo</a><small>Imágenes · Videos · PDF</small></>}</div> :
      <div className="asset-grid">{page.data.map(asset => <AssetCard key={asset.id} asset={asset} actions={remove && <button className="icon-button delete-button" disabled={deleting} title="Eliminar archivo" aria-label={`Eliminar ${asset.titulo}`} onClick={() => setSelected(asset)}><Icon name="trash" size={16}/></button>}/>)}</div>}
    {!loading && !error && page && page.meta.total > 0 && <nav className="pagination" aria-label="Páginas de la biblioteca"><span>{page.meta.total} {page.meta.total === 1 ? 'archivo' : 'archivos'}{filtered ? ' encontrados' : ''}</span><div><button className="icon-button previous" aria-label="Página anterior" disabled={page.meta.pagina <= 1} onClick={() => setQuery(previous => ({ ...previous, pagina: page.meta.pagina - 1 }))}><Icon name="arrow" size={17}/></button><span aria-live="polite">{page.meta.pagina} / {page.meta.totalPaginas}</span><button className="icon-button" aria-label="Página siguiente" disabled={page.meta.pagina >= page.meta.totalPaginas} onClick={() => setQuery(previous => ({ ...previous, pagina: page.meta.pagina + 1 }))}><Icon name="arrow" size={17}/></button></div></nav>}
    {selected && <DeleteDialog title={selected.titulo} busy={deleting} onCancel={() => setSelected(null)} onConfirm={() => void erase(selected)}/>}
  </section>;
}
