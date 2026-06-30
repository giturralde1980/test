import { test as base } from '@playwright/test';
import { AndaluciaPage } from '../pages/AndaluciaPage';

type Fixtures = {
  andaluciaPage: AndaluciaPage;
  authenticatedPage: AndaluciaPage;
};

export const test = base.extend<Fixtures>({
  andaluciaPage: async ({ page }, use) => {
    await use(new AndaluciaPage(page));
  },

  // Fixture pre-autenticado: la sesión viene del storageState (global-setup.ts)
  authenticatedPage: async ({ page }, use) => {
    const andaluciaPage = new AndaluciaPage(page);
    await andaluciaPage.navigate();
    await use(andaluciaPage);
  },
});

export { expect } from '@playwright/test';
