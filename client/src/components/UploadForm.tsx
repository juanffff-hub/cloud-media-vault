import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { validateDraft, type FormErrors } from '../lib/files';
import { ApiError, type Asset, type UploadFile } from '../lib/api';
import { Icon } from './Icon';
import { FilePicker } from './FilePicker';

export function UploadForm({ upload, onUploaded }: { upload: UploadFile; onUploaded?: (asset: Asset) => void }) {
  const prefix = useId();
  const [titulo, setTitulo] = useState('');
  const [subidoPor, setSubidoPor] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const active = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [percent, setPercent] = useState<number | null>(0);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const busy = phase !== 'idle';
  useEffect(() => () => { active.current?.abort(); }, []);
  const selectFile = (file: File | null, error?: string) => {
    setArchivo(file);
    setFeedback(null);
    setErrors(previous => ({ ...previous, archivo: error }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (active.current) return;
    const next = validateDraft(titulo, subidoPor, archivo);
    setErrors(next);
    if (Object.keys(next).length) {
      const first = next.titulo ? 'titulo' : next.subidoPor ? 'autor' : 'archivo';
      document.getElementById(`${prefix}-${first}`)?.focus();
      return;
    }
    const controller = new AbortController(); active.current = controller;
    setPhase('uploading'); setPercent(0); setFeedback(null);
    try {
      const asset = await upload({ titulo: titulo.normalize('NFC').trim(), subidoPor: subidoPor.normalize('NFC').trim(), archivo: archivo! }, {
        signal: controller.signal,
        onProgress: (value, processing) => { if (!controller.signal.aborted) { setPercent(value); setPhase(processing ? 'processing' : 'uploading'); } },
      });
      if (controller.signal.aborted) return;
      setTitulo(''); setArchivo(null); setErrors({});
      setFeedback({ kind: 'success', text: `«${asset.titulo}» ya está en tu biblioteca.` });
      onUploaded?.(asset);
    } catch (error) {
      if (!controller.signal.aborted) setFeedback({ kind: 'error', text: error instanceof ApiError ? error.message : 'No se pudo confirmar la carga. Revisa la biblioteca antes de volver a subir.' });
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) setPhase('idle');
    }
  };
  return <section className="upload-panel" id="subir" aria-labelledby={`${prefix}-heading`}>
    <div className="section-heading"><span className="icon-tile"><Icon name="upload"/></span><div><h2 id={`${prefix}-heading`}>Añadir archivo</h2><p>Un nuevo lugar para tus ideas.</p></div></div>
    <form onSubmit={submit} noValidate aria-label="Subir archivo" aria-busy={busy}>
      <fieldset disabled={busy}><legend className="visually-hidden">Datos del archivo</legend>
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
        <FilePicker id={`${prefix}-archivo`} file={archivo} error={errors.archivo} onSelect={selectFile} disabled={busy}/>
      </div>
      <button className="button button-primary upload-button" type="submit" disabled={busy}>{busy ? <span className="spinner"/> : <Icon name="upload"/>}{phase === 'processing' ? 'Guardando…' : busy ? 'Subiendo…' : 'Subir archivo'}</button>
      </fieldset>
      {busy && <div className="upload-progress" role="status"><p>{phase === 'processing' ? 'Confirmando el guardado…' : 'Enviando archivo'}<strong>{percent === null ? '' : `${percent}%`}</strong></p>
        <progress max={100} value={percent ?? undefined} aria-label="Progreso de subida"/>
        <small>{phase === 'processing' ? 'El envío terminó. Espera la confirmación.' : 'Mantén esta ventana abierta.'}</small></div>}
      {feedback && <p className={`feedback feedback-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.kind === 'success' && <Icon name="check" size={16}/>}<span>{feedback.text}</span></p>}
      <p className="form-note">Imágenes, videos y documentos. Un archivo a la vez.</p>
    </form>
  </section>;
}
