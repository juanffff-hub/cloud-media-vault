import { createApp } from './app.js';

const port = 3001;
createApp().listen(port, '127.0.0.1', () => {
  console.info(`Cloud Media Vault API disponible en http://127.0.0.1:${port}`);
});
