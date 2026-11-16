import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { UploadForm } from '../src/components/UploadForm';
import { ApiError, type Asset, type UploadOptions } from '../src/lib/api';
import { assetFixture } from './fixtures';

function fill() {
  fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Foto' } });
  fireEvent.change(screen.getByLabelText(/Autor/), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByLabelText(/^Archivo/), { target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] } });
}
test('bloquea doble envío, muestra progreso real y espera confirmación para limpiar', async () => {
  let finish!: (asset: Asset) => void; let options!: UploadOptions;
  const upload = vi.fn((_draft, received: UploadOptions) => { options = received; return new Promise<Asset>(resolve => { finish = resolve; }); });
  const onUploaded = vi.fn(); render(<UploadForm upload={upload} onUploaded={onUploaded}/>); fill();
  const form = screen.getByRole('form', { name: 'Subir archivo' });
  fireEvent.submit(form); fireEvent.submit(form); expect(upload).toHaveBeenCalledOnce();
  expect((screen.getByLabelText(/Título/) as HTMLInputElement).closest('fieldset')?.disabled).toBe(true);
  act(() => options.onProgress(42, false)); expect((screen.getByRole('progressbar') as HTMLProgressElement).value).toBe(42);
  act(() => options.onProgress(100, true)); expect(screen.getByText('Confirmando el guardado…')).toBeTruthy();
  expect(screen.getByText('foto.png')).toBeTruthy(); expect(onUploaded).not.toHaveBeenCalled();
  await act(async () => finish(assetFixture));
  expect(onUploaded).toHaveBeenCalledWith(assetFixture); expect(screen.queryByText('foto.png')).toBeNull();
  expect((screen.getByLabelText(/Autor/) as HTMLInputElement).value).toBe('Juan');
  expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe('');
});
test.each([['FILE_TOO_LARGE', 'El archivo supera los 10 MB.', 413], ['INVALID_FILE', 'El contenido no es válido.', 400], ['NETWORK_ERROR', 'Revisa la biblioteca antes de volver a subir.', 0]] as const)
('error %s conserva el formulario y permite corregirlo', async (code, message, status) => {
  const upload = vi.fn().mockRejectedValue(new ApiError(code, message, status));
  render(<UploadForm upload={upload}/>); fill(); fireEvent.submit(screen.getByRole('form'));
  expect((await screen.findByRole('alert')).textContent).toBe(message);
  expect(screen.getByText('foto.png')).toBeTruthy();
  await waitFor(() => expect((screen.getByRole('button', { name: 'Subir archivo' }) as HTMLButtonElement).disabled).toBe(false));
});
test('desmontar cancela la petición pendiente', () => {
  let signal!: AbortSignal;
  const upload = vi.fn((_draft, options: UploadOptions) => { signal = options.signal; return new Promise<Asset>(() => {}); });
  const view = render(<UploadForm upload={upload}/>); fill(); fireEvent.submit(screen.getByRole('form'));
  view.unmount(); expect(signal.aborted).toBe(true);
});
