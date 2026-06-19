import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class AndaluciaPage extends BasePage {
  // Filtros de fecha
  readonly dateDesde: Locator;
  readonly dateHasta: Locator;

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

  constructor(page: Page) {
    super(page, '/andalucia');

    this.dateDesde = page.locator('#dateDesde');
    this.dateHasta = page.locator('#dateHasta');
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
    await this.page.waitForLoadState('networkidle');
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
