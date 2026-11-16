import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: '**/live.spec.ts', workers: 1, timeout: 240_000,
  expect: { timeout: 20_000 }, reporter: 'list', outputDir: '../tmp/browser-live',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1100 },
    locale: 'es-CO', timezoneId: 'America/Bogota', actionTimeout: 20_000, navigationTimeout: 20_000, trace: 'off', screenshot: 'off' },
});
