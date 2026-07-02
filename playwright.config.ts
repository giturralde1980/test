import { defineConfig, devices } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // globalSetup: './tests/global-setup.ts',  // storageState no funciona: app usa sesión de servidor
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  timeout: process.env.CI ? 120_000 : 30_000,
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
    // ['allure-playwright'],
    ['list'],
    ['./reporters/testrail.reporter.ts'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://industriatest.ocaicp.com',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: process.env.HEADLESS !== 'false',
    acceptDownloads: true,
    launchOptions: {
      args: ['--disable-download-restrictions', '--safebrowsing-disable-download-protection'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'reports/test-results',
});
