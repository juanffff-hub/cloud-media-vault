import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { App } from '../src/App';

test('el punto de entrada presenta el producto en español', () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain('Cloud Media');
  expect(html).toContain('documentos PDF');
  expect(html).toContain('Saltar al contenido');
});
