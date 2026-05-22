import { test, expect } from '../fixtures/base.fixture';
import { TestData } from '../helpers/test-data';

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.navigate();
    await loginPage.waitForPageLoad();
  });

  test('debe mostrar el formulario de login', async ({ loginPage }) => {
    await expect(loginPage.userInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
    await expect(loginPage.loginButton).toContainText(/login/i);
  });

  test('debe mostrar el título INDUSTRIA', async ({ page }) => {
    await expect(page).toHaveTitle('INDUSTRIA');
  });

  test('login con usuario válido redirige a /andalucia', async ({ loginPage, page }) => {
    await loginPage.login(TestData.credentials.username);
    await expect(page).toHaveURL(/\/andalucia/);
  });

  test('el campo usuario acepta texto', async ({ loginPage }) => {
    await loginPage.userInput.fill(TestData.credentials.username);
    await expect(loginPage.userInput).toHaveValue(TestData.credentials.username);
  });

  test('login sin usuario permanece en login', async ({ loginPage, page }) => {
    await loginPage.loginButton.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\//);
    await expect(loginPage.userInput).toBeVisible();
  });

  test('botón LOGIN está habilitado', async ({ loginPage }) => {
    await expect(loginPage.loginButton).toBeEnabled();
  });

  test('login con usuario inválido muestra advertencia y permanece en login', async ({ loginPage, page }) => {
    await loginPage.userInput.fill('usuarioinvalido');
    await loginPage.loginButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.v-alert')).toBeVisible();
    await expect(page.locator('.v-alert')).toContainText('Campos en blanco.');
  });
});
