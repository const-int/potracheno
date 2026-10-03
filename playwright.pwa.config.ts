import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './pwa-tests',
  outputDir: './pwa-test-results',
  use: {
    ...devices['Pixel 7'],
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4175',
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/preview-pwa.mjs',
    url: 'http://127.0.0.1:4175/potracheno/',
    reuseExistingServer: !process.env.CI,
  },
});
