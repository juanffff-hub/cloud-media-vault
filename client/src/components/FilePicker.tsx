import { useRef, useState, type DragEvent } from 'react';
import { FILE_ACCEPT, fileCategory, formatBytes, validateFile } from '../lib/files';
import { Icon } from './Icon';
import { FilePreview } from './FilePreview';

interface Props { id: string; file: File | null; error?: string; disabled?: boolean; onSelect(file: File | null, error?: string): void }
export function FilePicker({ id, file, error, disabled = false, onSelect }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const select = (files: File[]) => {
    if (disabled) return;
    if (files.length !== 1) { onSelect(null, 'Elige un solo archivo a la vez.'); return; }
    const issue = validateFile(files[0]);
    onSelect(issue ? null : files[0], issue);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault(); event.stopPropagation(); depth.current = 0; setDragging(false);
    select(Array.from(event.dataTransfer.files));
  };
  const category = file ? fileCategory(file) : undefined;
  return <>
    <div className={`file-picker${dragging && !disabled ? ' is-dragging' : ''}`} role="group" aria-label="Zona para arrastrar archivo"
      onDragEnter={event => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) { depth.current++; setDragging(true); } }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'; }}
      onDragLeave={event => { event.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }} onDrop={drop}>
      <span className="file-picker-icon"><Icon name="upload" size={26}/></span>
      <p className="picker-title">{dragging && !disabled ? 'Suelta tu archivo aquí' : 'Arrastra tu archivo hasta aquí'}</p>
      <button type="button" className="button button-secondary" disabled={disabled} onClick={() => input.current?.click()}>{file ? 'Cambiar archivo' : 'Elegir archivo'}</button>
      <input className="visually-hidden" ref={input} id={id} type="file" accept={FILE_ACCEPT} disabled={disabled}
        onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) select(files); event.target.value = ''; }}
        aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}/>
      <p className="picker-formats" id={`${id}-help`}>JPEG, PNG, WebP · MP4, WebM · PDF</p>
    </div>
    {file && <div className="selected-file-wrap"><div className="selected-file"><Icon name={category === 'imagen' ? 'image' : category === 'video' ? 'video' : 'file'}/>
      <span>{file.name}<small>{formatBytes(file.size)} · {file.type}</small></span>
      <button type="button" className="icon-button" aria-label="Quitar archivo seleccionado" disabled={disabled} onClick={() => onSelect(null)}><Icon name="close" size={16}/></button>
    </div><FilePreview file={file}/></div>}
    {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
  </>;
}
