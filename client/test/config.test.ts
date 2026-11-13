import { expect, test } from 'vitest';
import { readClientEnvironment } from '../src/config';

test('los valores públicos predeterminados coinciden con el entorno local', () => {
  expect(readClientEnvironment({})).toEqual({
    apiBaseUrl: 'http://127.0.0.1:3001/api', maxFileSizeBytes: 10_485_760,
  });
});

test.each(['javascript:alert(1)', 'https://user:secret@example.test/api', 'https://example.test'])('rechaza una URL de API inválida', (url) => {
  expect(() => readClientEnvironment({ VITE_API_BASE_URL: url })).toThrow('VITE_API_BASE_URL');
});

test('cliente y servidor no pueden divergir del límite de 10 MiB', () => {
  expect(() => readClientEnvironment({ VITE_MAX_FILE_SIZE_MB: '20' })).toThrow('10');
});
