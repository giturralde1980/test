import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AndaluciaPage } from '../pages/AndaluciaPage';
import { MadridPage } from '../pages/MadridPage';
import { TestData } from '../helpers/test-data';

type Fixtures = {
  loginPage: LoginPage;
  andaluciaPage: AndaluciaPage;
  authenticatedPage: AndaluciaPage;
  authenticatedMadridPage: MadridPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  andaluciaPage: async ({ page }, use) => {
    await use(new AndaluciaPage(page));
  },

  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TestData.credentials.username, TestData.credentials.password);
    await use(new AndaluciaPage(page));
  },

  authenticatedMadridPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TestData.madridCredentials.username, TestData.madridCredentials.password);
    await use(new MadridPage(page));
  },
});

export { expect } from '@playwright/test';
