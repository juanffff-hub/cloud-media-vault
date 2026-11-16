import { useEffect, useState } from 'react';
import { fileCategory } from '../lib/files';
import { Icon } from './Icon';

export function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const url = preview?.file === file ? preview.url : null;
  if (!url) return null;
  const category = fileCategory(file);
  return <div className="file-preview">
    {category === 'imagen' && <img src={url} alt={`Vista previa de ${file.name}`}/>}
    {category === 'video' && <video src={url} controls muted playsInline preload="metadata" aria-label={`Vista previa de ${file.name}`}/>}
    {category === 'pdf' && <><object data={url} type="application/pdf" aria-label={`Vista previa de ${file.name}`}><p>Abre el PDF para revisarlo antes de subir.</p></object>
      <a href={url} target="_blank" rel="noopener noreferrer" className="preview-link">Abrir vista previa del PDF <Icon name="external" size={13}/></a></>}
  </div>;
}
