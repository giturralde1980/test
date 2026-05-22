import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly userInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page, '/');
    this.userInput = page.locator('#user');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('button:has-text("LOGIN")');
  }

  async login(username: string, password = ''): Promise<void> {
    await this.navigate();
    await this.userInput.fill(username);
    if (password) await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async isLoginFormVisible(): Promise<boolean> {
    return this.userInput.isVisible();
  }
}
