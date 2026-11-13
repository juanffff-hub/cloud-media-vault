import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { App } from '../src/App';

test('el punto de entrada presenta el producto en español', () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain('<h1>Cloud Media Vault</h1>');
  expect(html).toContain('documentos PDF');
});
