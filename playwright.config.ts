import { defineConfig, devices } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: process.env.CI ? 120_000 : 30_000,
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
    // ['allure-playwright'],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://industriatest.ocaicp.com',
    storageState: '.auth/session.json',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: process.env.HEADLESS !== 'false',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'reports/test-results',
});
