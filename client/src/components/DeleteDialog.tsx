import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
export function DeleteDialog({ title, busy, onCancel, onConfirm }: { title: string; busy: boolean; onCancel(): void; onConfirm(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal(); cancel.current?.focus();
    return () => element.close();
  }, []);
  return <dialog className="delete-dialog" ref={dialog} aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <span className="delete-icon"><Icon name="trash" size={25}/></span><h2 id="delete-title">¿Eliminar este archivo?</h2>
    <p id="delete-description">«{title}» se eliminará de la biblioteca y de su almacenamiento. Esta acción no se puede deshacer.</p>
    {busy && <p role="status">Eliminando… Espera la confirmación.</p>}
    <div className="dialog-actions"><button ref={cancel} className="button button-secondary" disabled={busy} onClick={onCancel}>Conservar archivo</button><button className="button button-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Eliminando…' : 'Eliminar archivo'}</button></div>
  </dialog>;
}
