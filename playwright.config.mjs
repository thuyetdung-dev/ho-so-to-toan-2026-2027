import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('Thiếu E2E_BASE_URL, ví dụ https://your-app.vercel.app');

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: process.env.E2E_AUTH_STATE || undefined,
  },
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
});
