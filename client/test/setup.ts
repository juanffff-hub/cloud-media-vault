import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => { cleanup(); sessionStorage.clear(); });
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: () => 'blob:test-preview' });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: () => {} });
