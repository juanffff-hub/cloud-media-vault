import { expect, test, vi } from 'vitest';
import { createMediaApi } from '../src/lib/api';
import { assetFixture } from './fixtures';

class FakeXhr extends EventTarget {
  upload = new EventTarget(); status = 0; responseText = ''; timeout = 0;
  open = vi.fn(); send = vi.fn();
  abort = vi.fn(() => this.dispatchEvent(new Event('abort')));
  respond(status: number, body: unknown) { this.status = status; this.responseText = JSON.stringify(body); this.dispatchEvent(new Event('load')); }
}
function setup() {
  const xhr = new FakeXhr();
  const client = createMediaApi('https://api.example.test/api', () => xhr as unknown as XMLHttpRequest);
  const controller = new AbortController(); const onProgress = vi.fn();
  const draft = { titulo: 'Foto', subidoPor: 'Juan', archivo: new File(['test'], 'foto.png', { type: 'image/png' }) };
  return { xhr, client, controller, onProgress, draft };
}
test('envía FormData y usa progreso de bytes, sin confundir 100% con persistencia', async () => {
  const { xhr, client, controller, onProgress, draft } = setup();
  const done = vi.fn(); const promise = client.upload(draft, { signal: controller.signal, onProgress }).then(done);
  expect(xhr.open).toHaveBeenCalledWith('POST', 'https://api.example.test/api/archivos');
  const body = xhr.send.mock.calls[0][0] as FormData;
  expect(body.get('titulo')).toBe('Foto'); expect(body.get('subidoPor')).toBe('Juan'); expect(body.get('archivo')).toBeInstanceOf(File);
  expect([...body.keys()]).toEqual(['titulo', 'subidoPor', 'archivo']);
  xhr.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 25, total: 100 }));
  expect(onProgress).toHaveBeenLastCalledWith(25, false);
  xhr.upload.dispatchEvent(new Event('load'));
  expect(onProgress).toHaveBeenLastCalledWith(100, true); expect(done).not.toHaveBeenCalled();
  xhr.respond(201, { data: assetFixture }); await promise;
  expect(done).toHaveBeenCalledWith(assetFixture);
  controller.abort(); expect(xhr.abort).not.toHaveBeenCalled();
});
test.each([[400, 'INVALID_FILE', 'contenido'], [413, 'FILE_TOO_LARGE', '10 MB'], [500, 'PERSISTENCE_UNCERTAIN', 'Revisa la biblioteca']] as const)
('error %s muestra texto seguro', async (status, code, expected) => {
  const { xhr, client, controller, onProgress, draft } = setup();
  const promise = client.upload(draft, { signal: controller.signal, onProgress });
  xhr.respond(status, { error: { code, message: 'SECRET INTERNAL TRACE' } });
  await expect(promise).rejects.toMatchObject({ code, status, message: expect.stringContaining(expected) });
});
test.each(['error', 'timeout', 'abort'])('fallo %s rechaza sin confirmar éxito', async event => {
  const { xhr, client, controller, onProgress, draft } = setup();
  const promise = client.upload(draft, { signal: controller.signal, onProgress });
  xhr.dispatchEvent(new Event(event)); await expect(promise).rejects.toThrow();
});
test('una respuesta 201 mal formada no se considera éxito y una cancelación cierra XHR', async () => {
  const { xhr, client, controller, onProgress, draft } = setup();
  const promise = client.upload(draft, { signal: controller.signal, onProgress });
  xhr.respond(201, { data: { ...assetFixture, secureUrl: 'javascript:alert(1)' } });
  await expect(promise).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  const second = setup();
  const cancelled = second.client.upload(second.draft, { signal: second.controller.signal, onProgress: second.onProgress });
  second.controller.abort(); await expect(cancelled).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(second.xhr.abort).toHaveBeenCalledOnce();
});
