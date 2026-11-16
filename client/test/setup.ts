import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: () => 'blob:test-preview' });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: () => {} });
