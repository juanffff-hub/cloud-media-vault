import { useId, useState, type FormEvent } from 'react';
import { validateDraft, type FormErrors, type UploadDraft } from '../lib/files';
import { Icon } from './Icon';
import { FilePicker } from './FilePicker';

export function UploadForm({ onValid }: { onValid?: (draft: UploadDraft) => void }) {
  const prefix = useId();
  const [titulo, setTitulo] = useState('');
  const [subidoPor, setSubidoPor] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const selectFile = (file: File | null, error?: string) => {
    setArchivo(file);
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
        <FilePicker id={`${prefix}-archivo`} file={archivo} error={errors.archivo} onSelect={selectFile}/>
      </div>
      <button className="button button-primary upload-button" type="submit" disabled={!onValid}><Icon name="upload"/>Subir archivo</button>
      <p className="form-note">Imágenes, videos y documentos. Un archivo a la vez.</p>
    </form>
  </section>;
}
