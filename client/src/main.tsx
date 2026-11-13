import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { readClientEnvironment } from './config';
import './styles.css';

readClientEnvironment(import.meta.env);

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
