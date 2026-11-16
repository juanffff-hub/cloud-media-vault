import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testIgnore: '**/live.spec.ts', fullyParallel: false, workers: 1,
  timeout: 30_000, expect: { timeout: 8_000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', locale: 'es-CO', timezoneId: 'America/Bogota', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: { command: 'npm run dev -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: false,
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:3001/api' } },
});
