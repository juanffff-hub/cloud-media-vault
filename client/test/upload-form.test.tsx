import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { UploadForm } from '../src/components/UploadForm';
import { MAX_FILE_BYTES, validateFile } from '../src/lib/files';
import { assetFixture } from './fixtures';
test('el formulario requiere título, autor y archivo y enfoca el primer error', async () => {
  const onValid = vi.fn(); render(<UploadForm upload={onValid}/>);
  await userEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));
  expect(screen.getAllByRole('alert')).toHaveLength(3);
  expect(document.activeElement).toBe(screen.getByLabelText(/Título/));
  expect(onValid).not.toHaveBeenCalled();
});
test('selección tradicional valida y entrega título y autor normalizados', async () => {
  const onValid = vi.fn().mockResolvedValue(assetFixture); render(<UploadForm upload={onValid}/>);
  await userEvent.type(screen.getByLabelText(/Título/), '  Mi fotografía  ');
  await userEvent.type(screen.getByLabelText(/Autor/), '  Juan  ');
  const archivo = new File(['image'], 'foto.png', { type: 'image/png' });
  await userEvent.upload(screen.getByLabelText(/^Archivo/), archivo);
  await userEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));
  expect(onValid).toHaveBeenCalledWith({ titulo: 'Mi fotografía', subidoPor: 'Juan', archivo }, expect.objectContaining({ onProgress: expect.any(Function) }));
  expect((await screen.findByRole('status')).textContent).toContain('ya está en tu biblioteca');
});
test('el formulario muestra el rechazo de un MIME no permitido', () => {
  render(<UploadForm upload={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText(/^Archivo/), { target: { files: [new File(['data'], 'archivo.exe', { type: 'application/octet-stream' })] } });
  expect(screen.getByRole('alert').textContent).toContain('Elige una imagen');
});
test('el límite de 10 MB es inclusivo y rechaza exceso, vacío o extensión incompatible', () => {
  const archivo = new File([new Uint8Array(MAX_FILE_BYTES)], 'foto.png', { type: 'image/png' });
  expect(validateFile(archivo)).toBeUndefined();
  expect(validateFile(new File([archivo, 'x'], 'foto.png', { type: 'image/png' }))).toContain('supera los 10 MB');
  expect(validateFile(new File([], 'foto.png', { type: 'image/png' }))).toContain('vacío');
  expect(validateFile(new File(['x'], 'foto.pdf', { type: 'image/png' }))).toContain('Elige una imagen');
});
