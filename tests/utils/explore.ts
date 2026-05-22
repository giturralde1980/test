import { test } from '@playwright/test';

test('explore invalid login behavior', async ({ page }) => {
  await page.goto('http://industriatest.ocaicp.com/');
  await page.waitForLoadState('networkidle');

  await page.fill('#user', 'usuarioinvalido');
  await page.click('button:has-text("LOGIN")');
  await page.waitForTimeout(2000);

  console.log('URL after invalid login:', page.url());
  console.log('Body text:\n', await page.evaluate(() => document.body.innerText));

  let dialogMsg = '';
  page.once('dialog', async d => { dialogMsg = d.message(); await d.accept(); });

  const snackbar = await page.locator('.v-snack--active, .v-snackbar--active, [class*="snack"][class*="active"]').count();
  const alert   = await page.locator('[role="alert"], .v-alert').count();
  const errors  = await page.locator('.error--text, .v-messages__message').count();

  console.log('Snackbar active:', snackbar);
  console.log('Alert elements:', alert);
  console.log('Error messages:', errors);
  console.log('Dialog message:', dialogMsg || 'none');

  if (errors > 0) {
    const msgs = await page.locator('.error--text, .v-messages__message').allInnerTexts();
    console.log('Error texts:', msgs);
  }
  if (alert > 0) {
    const msgs = await page.locator('[role="alert"], .v-alert').allInnerTexts();
    console.log('Alert texts:', msgs);
  }

  await page.screenshot({ path: 'reports/invalid-login.png', fullPage: true });
});
