import { useState, type ReactNode } from 'react';
import type { Asset } from '../lib/api';
import { formatBytes } from '../lib/files';
import { Icon } from './Icon';
export const categoryLabels = { imagen: 'Imagen', video: 'Video', pdf: 'PDF' };
const dates = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
export function AssetCard({ asset, actions }: { asset: Asset; actions?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  return <article className={`asset-card asset-${asset.categoria}`} aria-label={asset.titulo}>
    <div className="asset-preview">
      {failed ? <div className="media-unavailable"><Icon name="file"/><span>Vista previa no disponible</span><small>Puedes intentar abrir el archivo.</small></div> :
        asset.categoria === 'imagen' ? <img src={asset.secureUrl} alt={asset.titulo} loading="lazy" onError={() => setFailed(true)}/> :
        asset.categoria === 'video' ? <video src={asset.secureUrl} controls preload="metadata" playsInline aria-label={`Video: ${asset.titulo}`} onError={() => setFailed(true)}/> :
        <a className="pdf-cover" href={asset.secureUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir PDF: ${asset.titulo}`}><Icon name="file" size={42}/><strong>PDF</strong><span>Ver documento <Icon name="external" size={13}/></span></a>}
      <span className="category-badge">{categoryLabels[asset.categoria]}</span>
    </div>
    <div className="asset-body"><h3 title={asset.titulo}>{asset.titulo}</h3><p className="asset-author">Por {asset.subidoPor}</p>
      <p className="asset-filename" title={asset.nombreOriginal}>{asset.nombreOriginal}</p>
      <p className="asset-details"><span>{formatBytes(asset.tamanoBytes)}</span><span>{asset.mimeType}</span></p>
      <div className="asset-bottom"><time dateTime={asset.fechaSubida}>{dates.format(new Date(asset.fechaSubida))}</time><div className="asset-actions"><a className="icon-button" href={asset.secureUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${asset.titulo}`} title="Abrir archivo"><Icon name="external" size={16}/></a>{actions}</div></div>
    </div>
  </article>;
}
