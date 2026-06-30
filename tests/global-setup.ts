import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SESSION_FILE = join(process.cwd(), '.auth', 'session.json');

export default async function globalSetup() {
  mkdirSync(join(process.cwd(), '.auth'), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(process.env.BASE_URL || 'http://industriatest.ocaicp.com');
  await page.locator('#user').fill(process.env.TEST_USERNAME || '');
  const password = process.env.TEST_PASSWORD || '';
  if (password) await page.locator('#password').fill(password);
  await page.locator('button:has-text("LOGIN")').click();
  await page.waitForLoadState('networkidle');

  await page.context().storageState({ path: SESSION_FILE });
  await browser.close();
}
