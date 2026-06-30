import { test, expect } from '../../../fixtures/base.fixture';
import { TestData } from '../../../helpers/test-data';
import { MadridPage } from '../../../pages/MadridPage';

const { desde, hasta } = TestData.madrid.fechas;
const totales = TestData.madrid.totales;

async function setFechas(page: MadridPage): Promise<void> {
  await page.setDateViaCalendar(page.dateDesde, desde);
  await page.setDateViaCalendar(page.dateHasta, hasta);
}

test.use({ screenshot: 'on' });

test.describe('Madrid - Búsqueda por fechas 08-09 enero 2026', () => {
  test.describe.configure({ timeout: process.env.CI ? 120_000 : 60_000 });

  test('búsqueda básica por fechas (Periódicas activo por defecto) devuelve 37 registros', async ({ authenticatedMadridPage }) => {
    await expect(authenticatedMadridPage.btnPeriodicas).toHaveClass(/v-btn--active/);
    await authenticatedMadridPage.buscarPorFechas(desde, hasta);
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.periodicas);
  });

  test('filtro Corrección de defectos + fechas devuelve 56 registros', async ({ authenticatedMadridPage }) => {
    await authenticatedMadridPage.btnCorreccionDefectos.click();
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.correccionDefectos);
  });

  test('filtro SIN DEFECTOS + fechas devuelve 17 registros', async ({ authenticatedMadridPage }) => {
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.btnSinDefectos.click();
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.sinDefectos);
  });

  test('filtro LEVE A REPARAR + fechas devuelve 0 registros y muestra mensaje vacío', async ({ authenticatedMadridPage }) => {
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.btnLeveAReparar.click();
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.leve);
    await expect(authenticatedMadridPage.noDataMessage).toBeVisible();
  });

  test('filtro GRAVE + fechas devuelve 20 registros', async ({ authenticatedMadridPage }) => {
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.btnGrave.click();
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.grave);
  });

  test('filtro CRÍTICO + fechas devuelve 0 registros y muestra mensaje vacío', async ({ authenticatedMadridPage }) => {
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.btnCritico.click();
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.critico);
    await expect(authenticatedMadridPage.noDataMessage).toBeVisible();
  });

  test('búsqueda por número de pedido + fechas devuelve resultados que incluyen ese pedido', async ({ authenticatedMadridPage, page }) => {
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.numeroPedido.fill(TestData.madrid.pedido);
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBeGreaterThan(0);
    await expect(page.locator('tbody').getByText(TestData.madrid.pedido).first()).toBeVisible();
  });

  test('búsqueda por artículo + fechas devuelve resultados', async ({ authenticatedMadridPage }) => {
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.setArticulo(TestData.madrid.articulo);
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBeGreaterThan(0);
  });

});
