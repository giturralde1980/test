import { Page, Locator, test } from '@playwright/test';
import { BasePage } from './BasePage';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export class AndaluciaPage extends BasePage {
  dateDesde: Locator;
  dateHasta: Locator;
  dateDesdeSlot: Locator;
  dateHastaSlot: Locator;

  readonly numeroPedido: Locator;

  readonly delegacion: Locator;
  readonly provincia: Locator;
  readonly inspector: Locator;
  readonly tipoTramitacion: Locator;
  readonly articulos: Locator;

  readonly btnSinDefectos: Locator;
  readonly btnLeveAReparar: Locator;
  readonly btnGrave: Locator;
  readonly btnCritico: Locator;

  readonly btnBuscar: Locator;
  readonly btnGenerarXml: Locator;
  readonly btnSalir: Locator;

  readonly table: Locator;
  readonly noDataMessage: Locator;
  readonly rowsPerPageInput: Locator;

  private lastResultCount: number | null = null;

  constructor(page: Page, url = '/andalucia') {
    super(page, url);

    this.dateDesde     = page.locator('#dateDesde');
    this.dateHasta     = page.locator('#dateHasta');
    this.dateDesdeSlot = page.locator('.v-input__slot:has(#dateDesde)');
    this.dateHastaSlot = page.locator('.v-input__slot:has(#dateHasta)');
    this.numeroPedido = page.locator('.v-input').filter({ hasText: /n[uú]mero de pedido/i }).locator('input').first();

    this.delegacion = page.locator('.v-input').filter({ hasText: 'Delegación' }).locator('input').first();
    this.provincia = page.locator('.v-input').filter({ hasText: 'Provincia' }).locator('input').first();
    this.inspector = page.locator('.v-input').filter({ hasText: 'Inspector' }).locator('input').first();
    this.tipoTramitacion = page.locator('.v-input').filter({ hasText: 'Tipo de tramitación' }).locator('input').first();
    this.articulos = page.locator('.v-input').filter({ hasText: /articulos/i }).first();

    this.btnSinDefectos = page.locator('button:has-text("SIN DEFECTOS")');
    this.btnLeveAReparar = page.locator('button:has-text("LEVE A REPARAR")');
    this.btnGrave = page.locator('button:has-text("GRAVE")');
    this.btnCritico = page.locator('button:has-text("CRÍTICO")');

    this.btnBuscar = page.locator('button:has-text("BUSCAR")');
    this.btnGenerarXml = page.locator('button:has-text("GENERAR XML")');
    this.btnSalir = page.getByRole('link', { name: /salir/i });

    this.table = page.locator('.v-data-table');
    this.noDataMessage = page.locator('text=No data available');
    this.rowsPerPageInput = page.locator('.v-data-footer__select .v-select');
  }

  async buscar(): Promise<void> {
    await test.step('Clic en BUSCAR', async () => {
      this.lastResultCount = null;
      const loaderTimeout = process.env.CI ? 90_000 : 60_000;

      const [response] = await Promise.all([
        this.page.waitForResponse(
          resp => /\/Buscar(And|Mad)\b/i.test(resp.url()) && resp.status() === 200,
          { timeout: loaderTimeout }
        ).catch(() => null),
        this.btnBuscar.click(),
      ]);

      if (response) {
        try {
          const data = await response.json();
          if (Array.isArray(data)) this.lastResultCount = data.length;
        } catch {
        }
      }

      const loader = this.page.locator('text=Pasito a pasito...');
      await loader.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
      await loader.waitFor({ state: 'hidden', timeout: loaderTimeout }).catch(() => {});
    });
  }

  async setDateViaCalendar(inputLocator: Locator, isoDate: string): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    const slotLocator = inputLocator === this.dateDesde ? this.dateDesdeSlot : this.dateHastaSlot;
    await inputLocator.click();
    await slotLocator.click();

    const allBodies = this.page.locator('.v-picker__body');
    let pickerBody!: Locator;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const n = await allBodies.count();
      for (let i = 0; i < n; i++) {
        if (await allBodies.nth(i).isVisible()) {
          pickerBody = allBodies.nth(i);
          break;
        }
      }
      if (pickerBody) break;
      await this.page.waitForTimeout(200);
    }
    if (!pickerBody) throw new Error('El date picker no se abrió');

    const [year, month, day] = isoDate.split('-').map(Number);

    for (let attempt = 0; attempt < 24; attempt++) {
      const headerText = await pickerBody
        .locator('.v-date-picker-header__value button')
        .first()
        .innerText();
      const [mesStr, yearStr] = headerText.toLowerCase().trim().split(' de ');
      const currentMonth = MESES.indexOf(mesStr) + 1;
      const currentYear = parseInt(yearStr, 10);

      if (currentYear === year && currentMonth === month) {
        await pickerBody
          .locator('.v-date-picker-table')
          .locator('button:not([disabled]):not(.v-btn--disabled)')
          .filter({ hasText: new RegExp(`^${day}$`) })
          .first()
          .click();
        await pickerBody.waitFor({ state: 'hidden', timeout: 3000 }).catch(async () => {
          await this.page.keyboard.press('Escape');
        });
        return;
      }

      const diff = (year * 12 + month) - (currentYear * 12 + currentMonth);
      const ariaLabel = diff < 0 ? 'Previous month' : 'Next month';
      await pickerBody.locator(`button[aria-label="${ariaLabel}"]`).click();
      await this.page.waitForTimeout(300);
    }
    throw new Error(`No se pudo navegar al día ${isoDate} en el date picker`);
  }

  async buscarPorFechas(desde: string, hasta: string): Promise<void> {
    await this.btnBuscar.waitFor({ state: 'visible', timeout: 20_000 });
    await test.step(`Informar fecha desde: ${desde}`, () => this.setDateViaCalendar(this.dateDesde, desde));
    await test.step(`Informar fecha hasta: ${hasta}`, () => this.setDateViaCalendar(this.dateHasta, hasta));
    await this.buscar();
  }

  async getTotalResultCount(): Promise<number> {
    if (this.lastResultCount !== null) {
      if (this.lastResultCount > 0) return this.lastResultCount;
      const noData = await this.noDataMessage.isVisible().catch(() => false);
      if (noData) return 0;
    }
    return this.getTotalResultCountByPolling();
  }

  private async getTotalResultCountByPolling(): Promise<number> {
    const loaderTimeout = process.env.CI ? 90_000 : 60_000;
    const loader = this.page.locator('text=Pasito a pasito...');
    if (await loader.isVisible()) {
      await loader.waitFor({ state: 'hidden', timeout: loaderTimeout }).catch(() => {});
    }
    const noDataOrFooter = this.noDataMessage.or(this.page.locator('.v-data-footer__pagination'));
    await noDataOrFooter.first().waitFor({ state: 'visible', timeout: 15_000 });

    const pollMs = process.env.CI ? 45_000 : 35_000;
    const pollInterval = process.env.CI ? 1_000 : 500;
    const deadline = Date.now() + pollMs;
    let prevCount = -1;
    let stableStreak = 0;
    while (Date.now() < deadline) {
      if (await this.noDataMessage.isVisible()) {
        await this.page.waitForTimeout(3_000);
        if (await this.noDataMessage.isVisible()) return 0;
      }
      const text = await this.page.locator('.v-data-footer__pagination').innerText().catch(() => '');
      const match = text.match(/of (\d+)/);
      const count = match ? parseInt(match[1], 10) : 0;
      if (count > 0 && count === prevCount) {
        stableStreak++;
        if (stableStreak >= 2) return count;
      } else {
        stableStreak = 0;
      }
      prevCount = count;
      await this.page.waitForTimeout(pollInterval);
    }

    if (await this.noDataMessage.isVisible()) return 0;
    const text = await this.page.locator('.v-data-footer__pagination').innerText();
    const match = text.match(/of (\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async setArticulo(value: string): Promise<void> {
    await test.step(`Seleccionar artículo: ${value}`, async () => {
      await this.articulos.locator('.v-input__slot').click();
      const input = this.articulos.locator('input').first();
      await input.fill(value);
      const option = this.page.locator('.menuable__content__active .v-list-item__title').filter({ hasText: value }).first();
      await option.waitFor({ state: 'visible', timeout: 8_000 });
      await option.click();
    });
  }

  async selectTableRow(index = 0): Promise<void> {
    await test.step(`Seleccionar fila de la tabla (índice ${index})`, async () => {
      const checkbox = this.page.locator('tbody .v-input--selection-controls__input').nth(index);
      await checkbox.waitFor({ state: 'visible', timeout: 15_000 });
      await checkbox.click();
    });
  }

  async salir(): Promise<void> {
    await test.step('Clic en SALIR', async () => {
      await this.btnSalir.click();
      await this.page.waitForLoadState('networkidle');
    });
  }

  async getTableHeaders(): Promise<string[]> {
    return this.page.$$eval('th', ths =>
      ths.map(th => (th as HTMLElement).innerText.trim()).filter(t => t)
    );
  }
}
