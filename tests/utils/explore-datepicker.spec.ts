import { test } from '../fixtures/base.fixture';

test('explore date picker — keyboard y mouse strategies', async ({ authenticatedPage, page }) => {
  const input = authenticatedPage.dateDesde;

  const checkPicker = async (label: string) => {
    await page.waitForTimeout(800);
    const pickerVisible = await page.locator('.v-picker__body').first().isVisible().catch(() => false);
    const ariaExpanded = await input.getAttribute('aria-expanded');
    const pickerCount = await page.locator('.v-picker__body').count();
    console.log(`[${label}] aria-expanded=${ariaExpanded} | v-picker__body count=${pickerCount} | visible=${pickerVisible}`);
    if (pickerVisible) {
      const headerText = await page.locator('.v-date-picker-header__value button').first().innerText().catch(() => 'N/A');
      console.log(`[${label}] Header: ${headerText}`);
    }
    await page.screenshot({ path: `reports/dp-${label.replace(/\s/g, '_')}.png`, fullPage: true });
    return pickerVisible;
  };

  await input.click();
  if (await checkPicker('click-input')) return;

  await input.press('Enter');
  if (await checkPicker('press-enter')) return;

  await input.press(' ');
  if (await checkPicker('press-space')) return;

  await page.locator('.v-input__slot:has(#dateDesde)').click();
  if (await checkPicker('click-slot')) return;

  const bbox = await input.boundingBox();
  if (bbox) {
    await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
  }
  if (await checkPicker('mouse-down-up')) return;

  await input.click({ force: true });
  if (await checkPicker('click-force')) return;

  console.log('❌ Ninguna estrategia abrió el picker');
});
