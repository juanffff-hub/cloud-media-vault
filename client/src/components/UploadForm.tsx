import { useId, useRef, useState, type FormEvent } from 'react';
import { FILE_ACCEPT, formatBytes, validateDraft, validateFile, type FormErrors, type UploadDraft } from '../lib/files';
import { Icon } from './Icon';

export function UploadForm({ onValid }: { onValid?: (draft: UploadDraft) => void }) {
  const prefix = useId();
  const input = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState('');
  const [subidoPor, setSubidoPor] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const selectFile = (file?: File) => {
    const error = validateFile(file);
    setArchivo(error ? null : file!);
    setErrors(previous => ({ ...previous, archivo: error }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validateDraft(titulo, subidoPor, archivo);
    setErrors(next);
    if (Object.keys(next).length) {
      const first = next.titulo ? 'titulo' : next.subidoPor ? 'autor' : 'archivo';
      document.getElementById(`${prefix}-${first}`)?.focus();
      return;
    }
    onValid?.({ titulo: titulo.normalize('NFC').trim(), subidoPor: subidoPor.normalize('NFC').trim(), archivo: archivo! });
  };
  return <section className="upload-panel" id="subir" aria-labelledby={`${prefix}-heading`}>
    <div className="section-heading"><span className="icon-tile"><Icon name="upload"/></span><div><h2 id={`${prefix}-heading`}>Añadir archivo</h2><p>Un nuevo lugar para tus ideas.</p></div></div>
    <form onSubmit={submit} noValidate>
      <div className="field"><label htmlFor={`${prefix}-titulo`}>Título <span>obligatorio</span></label>
        <input id={`${prefix}-titulo`} value={titulo} onChange={event => setTitulo(event.target.value)} maxLength={160} placeholder="Ej. Recuerdos del viaje" required
          aria-invalid={Boolean(errors.titulo)} aria-describedby={errors.titulo ? `${prefix}-titulo-error` : undefined}/>
        {errors.titulo && <p className="field-error" id={`${prefix}-titulo-error`} role="alert">{errors.titulo}</p>}
      </div>
      <div className="field"><label htmlFor={`${prefix}-autor`}>Autor <span>obligatorio</span></label>
        <input id={`${prefix}-autor`} value={subidoPor} onChange={event => setSubidoPor(event.target.value)} maxLength={100} placeholder="Tu nombre" autoComplete="name" required
          aria-invalid={Boolean(errors.subidoPor)} aria-describedby={errors.subidoPor ? `${prefix}-autor-error` : `${prefix}-autor-help`}/>
        <p className="field-help" id={`${prefix}-autor-help`}>Así aparecerá el nombre de quien lo sube.</p>
        {errors.subidoPor && <p className="field-error" id={`${prefix}-autor-error`} role="alert">{errors.subidoPor}</p>}
      </div>
      <div className="field"><label htmlFor={`${prefix}-archivo`}>Archivo <span>hasta 10 MB</span></label>
        <div className="file-picker"><span className="file-picker-icon"><Icon name="upload" size={26}/></span>
          <p className="picker-title">Dale espacio a tu contenido</p>
          <button type="button" className="button button-secondary" onClick={() => input.current?.click()}>Elegir archivo</button>
          <input className="visually-hidden" ref={input} id={`${prefix}-archivo`} type="file" accept={FILE_ACCEPT}
            onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ''; }}
            aria-invalid={Boolean(errors.archivo)} aria-describedby={`${prefix}-file-help${errors.archivo ? ` ${prefix}-file-error` : ''}`}/>
          <p className="picker-formats" id={`${prefix}-file-help`}>JPEG, PNG, WebP · MP4, WebM · PDF</p>
        </div>
        {archivo && <p className="selected-file"><Icon name="file"/><span>{archivo.name}<small>{formatBytes(archivo.size)}</small></span></p>}
        {errors.archivo && <p className="field-error" id={`${prefix}-file-error`} role="alert">{errors.archivo}</p>}
      </div>
      <button className="button button-primary upload-button" type="submit" disabled={!onValid}><Icon name="upload"/>Subir archivo</button>
      <p className="form-note">Imágenes, videos y documentos. Un archivo a la vez.</p>
    </form>
  </section>;
}
