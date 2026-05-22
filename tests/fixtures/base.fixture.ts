import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AndaluciaPage } from '../pages/AndaluciaPage';
import { TestData } from '../helpers/test-data';

type Fixtures = {
  loginPage: LoginPage;
  andaluciaPage: AndaluciaPage;
  authenticatedPage: AndaluciaPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  andaluciaPage: async ({ page }, use) => {
    await use(new AndaluciaPage(page));
  },

  // Fixture pre-autenticado: hace login y entrega la página de Andalucía lista
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TestData.credentials.username);
    await use(new AndaluciaPage(page));
  },
});

export { expect } from '@playwright/test';
