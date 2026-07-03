import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export class AndaluciaPage extends BasePage {
  // Filtros de fecha — input (para asserts) y slot (para abrir el picker)
  readonly dateDesde: Locator;
  readonly dateHasta: Locator;
  readonly dateDesdeSlot: Locator;
  readonly dateHastaSlot: Locator;

  // Filtros de texto/select
  // Nota: los IDs input-XX son generados por Vuetify y pueden cambiar;
  // se localizan por el contenedor del label si los IDs fallan.
  readonly numeroPedido: Locator;

  // Selectores Vuetify (autocomplete / combobox)
  readonly delegacion: Locator;
  readonly inspector: Locator;
  readonly tipoTramitacion: Locator;
  readonly articulos: Locator;

  // Botones de resultado
  readonly btnSinDefectos: Locator;
  readonly btnLeveAReparar: Locator;
  readonly btnGrave: Locator;
  readonly btnCritico: Locator;

  // Acciones principales
  readonly btnBuscar: Locator;
  readonly btnGenerarXml: Locator;
  readonly btnSalir: Locator;

  // Tabla de resultados
  readonly table: Locator;
  readonly noDataMessage: Locator;
  readonly rowsPerPageInput: Locator;

  constructor(page: Page, url = '/andalucia') {
    super(page, url);

    this.dateDesde     = page.locator('#dateDesde');
    this.dateHasta     = page.locator('#dateHasta');
    this.dateDesdeSlot = page.locator('.v-input__slot:has(#dateDesde)');
    this.dateHastaSlot = page.locator('.v-input__slot:has(#dateHasta)');
    this.numeroPedido = page.locator('.v-input').filter({ hasText: /n[uú]mero de pedido/i }).locator('input').first();

    // Vuetify selects — se buscan por texto del label padre
    this.delegacion = page.locator('.v-input').filter({ hasText: 'Delegación' }).locator('input').first();
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
    await this.btnBuscar.click();
    // Esperar primero a que aparezca el loader (hasta 5s), luego a que desaparezca (hasta 60s)
    // Si nunca aparece (respuesta instantánea), ambas llamadas resuelven inmediatamente
    const loader = this.page.locator('text=Pasito a pasito...');
    const loaderTimeout = process.env.CI ? 90_000 : 60_000;
    await loader.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await loader.waitFor({ state: 'hidden', timeout: loaderTimeout }).catch(() => {});
  }

  async setDateViaCalendar(inputLocator: Locator, isoDate: string): Promise<void> {
    // Esperar que la página esté interactiva antes de tocar los date pickers
    await this.page.waitForLoadState('domcontentloaded');
    // La secuencia que abre el picker: primero foco en el input, luego click en el slot
    const slotLocator = inputLocator === this.dateDesde ? this.dateDesdeSlot : this.dateHastaSlot;
    await inputLocator.click();
    await slotLocator.click();

    // Puede haber dos .v-picker__body en el DOM (uno por campo de fecha).
    // Buscamos el que se vuelve visible tras el click.
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
      // Leer mes y año de la cabecera: ej. "enero de 2026"
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
    await this.setDateViaCalendar(this.dateDesde, desde);
    await this.setDateViaCalendar(this.dateHasta, hasta);
    await this.buscar();
  }

  async getTotalResultCount(): Promise<number> {
    const loaderTimeout = process.env.CI ? 90_000 : 60_000;
    const loader = this.page.locator('text=Pasito a pasito...');
    if (await loader.isVisible()) {
      await loader.waitFor({ state: 'hidden', timeout: loaderTimeout }).catch(() => {});
    }
    const noDataOrFooter = this.noDataMessage.or(this.page.locator('.v-data-footer__pagination'));
    await noDataOrFooter.first().waitFor({ state: 'visible', timeout: 15_000 });

    // Poll hasta que el count sea estable 3 lecturas seguidas (el servidor carga en batches).
    // 3 lecturas (×500ms = 1s de estabilidad) evita capturar lotes intermedios que
    // coincidan en dos lecturas consecutivas antes de que llegue el último batch.
    const pollMs = process.env.CI ? 45_000 : 35_000;
    // En CI los lotes intermedios pueden ser estables >1s; usar intervalos más largos
    // exige 3 segundos de estabilidad real antes de aceptar el count como definitivo.
    const pollInterval = process.env.CI ? 1_000 : 500;
    const deadline = Date.now() + pollMs;
    let prevCount = -1;
    let stableStreak = 0;
    while (Date.now() < deadline) {
      // Doble confirmación antes de devolver 0: el noDataMessage puede aparecer
      // brevemente durante la transición post-loader antes de que los datos rendericen.
      if (await this.noDataMessage.isVisible()) {
        await this.page.waitForTimeout(pollInterval);
        if (await this.noDataMessage.isVisible()) return 0;
      }
      const text = await this.page.locator('.v-data-footer__pagination').innerText();
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
    await this.articulos.locator('.v-input__slot').click();
    const input = this.articulos.locator('input').first();
    await input.fill(value);
    const option = this.page.locator('.menuable__content__active .v-list-item__title').filter({ hasText: value }).first();
    await option.waitFor({ state: 'visible', timeout: 8_000 });
    await option.click();
  }

  async selectTableRow(index = 0): Promise<void> {
    await this.page.locator('tbody .v-input--selection-controls__input').nth(index).click();
  }

  async salir(): Promise<void> {
    await this.btnSalir.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getTableHeaders(): Promise<string[]> {
    return this.page.$$eval('th', ths =>
      ths.map(th => (th as HTMLElement).innerText.trim()).filter(t => t)
    );
  }

  async getTableRowCount(): Promise<number> {
    const rows = await this.page.$$('tbody tr');
    return rows.length;
  }

  async isResultFilterActive(button: Locator): Promise<boolean> {
    const cls = await button.getAttribute('class') ?? '';
    return cls.includes('v-btn--active') || cls.includes('active');
  }
}
