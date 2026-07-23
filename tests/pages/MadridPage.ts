import { Page, Locator } from '@playwright/test';
import { AndaluciaPage } from './AndaluciaPage';

export class MadridPage extends AndaluciaPage {
  readonly btnPeriodicas: Locator;
  readonly btnCorreccionDefectos: Locator;
  readonly btnGenerarDbf: Locator;

  constructor(page: Page) {
    super(page, '/madrid');

    const fechaDesde = page.locator('.v-input').filter({ hasText: /fecha inicio inspecci.*desde/i });
    const fechaHasta = page.locator('.v-input').filter({ hasText: /fecha inicio inspecci.*hasta/i });
    (this as any).dateDesde     = fechaDesde.locator('input').first();
    (this as any).dateDesdeSlot = fechaDesde.locator('.v-input__slot').first();
    (this as any).dateHasta     = fechaHasta.locator('input').first();
    (this as any).dateHastaSlot = fechaHasta.locator('.v-input__slot').first();

    this.btnPeriodicas         = page.locator('button').filter({ hasText: /^Periódicas$/ });
    this.btnCorreccionDefectos = page.locator('button').filter({ hasText: /^Corrección de defectos$/ });
    this.btnGenerarDbf         = page.locator('button').filter({ hasText: /generar dbf/i });
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
