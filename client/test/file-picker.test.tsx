import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { UploadForm } from '../src/components/UploadForm';
import { FilePreview } from '../src/components/FilePreview';
afterEach(() => vi.restoreAllMocks());
const png = new File(['png'], 'foto.png', { type: 'image/png' });
test('arrastrar un archivo lo selecciona y muestra nombre, tipo y previsualización', () => {
  render(<UploadForm onValid={vi.fn()}/>);
  const zone = screen.getByRole('group', { name: 'Zona para arrastrar archivo' });
  fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } });
  expect(screen.getByText('Suelta tu archivo aquí')).toBeTruthy();
  fireEvent.drop(zone, { dataTransfer: { files: [png] } });
  expect(screen.getByText('foto.png')).toBeTruthy();
  expect(screen.getByText(/image\/png/)).toBeTruthy();
  expect(screen.getByAltText('Vista previa de foto.png')).toBeTruthy();
});
test('soltar varios archivos muestra un error y no los acepta', () => {
  render(<UploadForm onValid={vi.fn()}/>);
  fireEvent.drop(screen.getByRole('group'), { dataTransfer: { files: [png, png] } });
  expect(screen.getByRole('alert').textContent).toContain('un solo archivo');
  expect(screen.queryByAltText('Vista previa de foto.png')).toBeNull();
});
test('quitar o reemplazar un archivo revoca sus URLs temporales, incluso en StrictMode', () => {
  let sequence = 0;
  const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:preview-${++sequence}`);
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  const view = render(<StrictMode><FilePreview file={png}/></StrictMode>);
  view.rerender(<StrictMode><FilePreview file={new File(['pdf'], 'guia.pdf', { type: 'application/pdf' })}/></StrictMode>);
  expect(screen.getByRole('link', { name: /Abrir vista previa del PDF/ }).getAttribute('href')).toMatch(/^blob:/);
  view.unmount();
  expect(revoke.mock.calls.map(([url]) => url).sort()).toEqual(create.mock.results.map(result => result.value).sort());
});
test('video usa controles nativos y quitar archivo retira la vista previa', () => {
  render(<UploadForm onValid={vi.fn()}/>);
  fireEvent.drop(screen.getByRole('group'), { dataTransfer: { files: [new File(['video'], 'clip.webm', { type: 'video/webm' })] } });
  expect((screen.getByLabelText('Vista previa de clip.webm') as HTMLVideoElement).controls).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Quitar archivo seleccionado' }));
  expect(screen.queryByLabelText('Vista previa de clip.webm')).toBeNull();
});
