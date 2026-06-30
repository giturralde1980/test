import { Page, Locator } from '@playwright/test';
import { AndaluciaPage } from './AndaluciaPage';

export class MadridPage extends AndaluciaPage {
  readonly btnPeriodicas: Locator;
  readonly btnCorreccionDefectos: Locator;

  constructor(page: Page) {
    super(page, '/madrid');

    this.btnPeriodicas         = page.locator('button').filter({ hasText: /^Periódicas$/ });
    this.btnCorreccionDefectos = page.locator('button').filter({ hasText: /^Corrección de defectos$/ });
  }

  async isPeriodicas(): Promise<boolean> {
    const cls = await this.btnPeriodicas.getAttribute('class') ?? '';
    return cls.includes('v-btn--active');
  }

  async isCorreccionDefectos(): Promise<boolean> {
    const cls = await this.btnCorreccionDefectos.getAttribute('class') ?? '';
    return cls.includes('v-btn--active');
  }
}
