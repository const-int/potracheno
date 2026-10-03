import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    locale: 'ru-RU',
    timezoneId: 'Europe/Kaliningrad',
  },
  webServer: {
    command: 'npm run dev -- --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'https://potracheno-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } }],
});
