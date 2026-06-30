import { test, expect } from '../../../fixtures/base.fixture';
import { TestData } from '../../../helpers/test-data';
import { AndaluciaPage } from '../../../pages/AndaluciaPage';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DOWNLOADS_DIR = join(process.cwd(), 'reports', 'downloads');

const { desde, hasta } = TestData.busquedas.fechas;
const totales = TestData.busquedas.totales;

async function setFechas(page: AndaluciaPage): Promise<void> {
  await page.setDateViaCalendar(page.dateDesde, desde);
  await page.setDateViaCalendar(page.dateHasta, hasta);
}

test.use({ screenshot: 'on' });

test.describe('Andalucía - Búsqueda por fechas 08-09 enero 2026', () => {
  test.describe.configure({ timeout: process.env.CI ? 120_000 : 60_000 });

  test('búsqueda básica por fechas devuelve 165 registros', async ({ authenticatedPage }) => {
    await authenticatedPage.buscarPorFechas(desde, hasta);
    expect(await authenticatedPage.getTotalResultCount()).toBe(totales.porFechas);
  });

  test('filtro SIN DEFECTOS + fechas devuelve 100 registros', async ({ authenticatedPage }) => {
    await setFechas(authenticatedPage);
    await authenticatedPage.btnSinDefectos.click();
    await authenticatedPage.buscar();
    expect(await authenticatedPage.getTotalResultCount()).toBe(totales.sinDefectos);
  });

  test('filtro LEVE A REPARAR + fechas devuelve 33 registros', async ({ authenticatedPage }) => {
    await setFechas(authenticatedPage);
    await authenticatedPage.btnLeveAReparar.click();
    await authenticatedPage.buscar();
    expect(await authenticatedPage.getTotalResultCount()).toBe(totales.leve);
  });

  test('filtro GRAVE + fechas devuelve 32 registros', async ({ authenticatedPage }) => {
    await setFechas(authenticatedPage);
    await authenticatedPage.btnGrave.click();
    await authenticatedPage.buscar();
    expect(await authenticatedPage.getTotalResultCount()).toBe(totales.grave);
  });

  test('filtro CRÍTICO + fechas devuelve 0 registros y muestra mensaje vacío', async ({ authenticatedPage }) => {
    await setFechas(authenticatedPage);
    await authenticatedPage.btnCritico.click();
    await authenticatedPage.buscar();
    expect(await authenticatedPage.getTotalResultCount()).toBe(totales.critico);
    await expect(authenticatedPage.noDataMessage).toBeVisible();
  });

  test('búsqueda por número de pedido + fechas devuelve resultados que incluyen ese pedido', async ({ authenticatedPage, page }) => {
    await setFechas(authenticatedPage);
    await authenticatedPage.numeroPedido.fill(TestData.busquedas.pedido);
    await authenticatedPage.buscar();
    expect(await authenticatedPage.getTotalResultCount()).toBeGreaterThan(0);
    await expect(page.locator('tbody').getByText(TestData.busquedas.pedido).first()).toBeVisible();
  });

  test('búsqueda por artículo + fechas devuelve 6 registros', async ({ authenticatedPage }) => {
    await setFechas(authenticatedPage);
    await authenticatedPage.setArticulo(TestData.busquedas.articulo);
    await authenticatedPage.buscar();
    expect(await authenticatedPage.getTotalResultCount()).toBe(totales.articulo);
  });

  test('seleccionar una inspección y generar XML descarga un fichero .xml', async ({ authenticatedPage, page }) => {
    await authenticatedPage.buscarPorFechas(desde, hasta);
    await authenticatedPage.selectTableRow(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      authenticatedPage.btnGenerarXml.click(),
    ]);

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^SIOCA_\d{8}_\d{6}\.xml$/i);

    // Guardar en reports/downloads/ — en GH Actions esta carpeta se sube como artifact
    mkdirSync(DOWNLOADS_DIR, { recursive: true });
    await download.saveAs(join(DOWNLOADS_DIR, filename));
  });

});
