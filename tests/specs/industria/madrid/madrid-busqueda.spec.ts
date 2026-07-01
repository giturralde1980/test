import { test, expect } from '../../../fixtures/base.fixture';
import { TestData } from '../../../helpers/test-data';
import { MadridPage } from '../../../pages/MadridPage';
import { mkdirSync } from 'fs';
import { join } from 'path';
import AdmZip from 'adm-zip';

const DOWNLOADS_DIR = join(process.cwd(), 'reports', 'downloads');

const { desde, hasta } = TestData.madrid.fechas;
const totales = TestData.madrid.totales;

async function setFechas(page: MadridPage): Promise<void> {
  await page.btnBuscar.waitFor({ state: 'visible' });
  await page.setDateViaCalendar(page.dateDesde, desde);
  await page.setDateViaCalendar(page.dateHasta, hasta);
}

test.use({ screenshot: 'on' });

test.describe('Madrid - Búsqueda por fechas 08-09 enero 2026', () => {
  test.describe.configure({ timeout: process.env.CI ? 120_000 : 90_000 });

  test('Verificar que la búsqueda básica por fechas con Periódicas activo devuelve 37 registros', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C250' });
    await expect(authenticatedMadridPage.btnPeriodicas).toHaveClass(/v-btn--active/);
    await authenticatedMadridPage.buscarPorFechas(desde, hasta);
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.periodicas);
  });

  test('Verificar que el filtro Corrección de Defectos + fechas devuelve 56 registros', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C251' });
    await authenticatedMadridPage.btnCorreccionDefectos.click();
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.correccionDefectos);
  });

  test('Verificar que el filtro Sin Defectos + fechas devuelve 17 registros', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C252' });
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.btnSinDefectos.click();
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.sinDefectos);
  });

  test('Verificar que el filtro Leve a Reparar + fechas devuelve 0 registros y la tabla aparece vacía', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C253' });
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.btnLeveAReparar.click();
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.leve);
    await expect(authenticatedMadridPage.noDataMessage).toBeVisible();
  });

  test('Verificar que el filtro Grave + fechas devuelve 20 registros', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C254' });
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.btnGrave.click();
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.grave);
  });

  test('Verificar que el filtro Crítico + fechas devuelve 0 registros y la tabla aparece vacía', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C255' });
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.btnCritico.click();
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBe(totales.critico);
    await expect(authenticatedMadridPage.noDataMessage).toBeVisible();
  });

  test('Verificar que la búsqueda por número de pedido + fechas devuelve resultados que incluyen ese pedido', async ({ authenticatedMadridPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C256' });
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.numeroPedido.fill(TestData.madrid.pedido);
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBeGreaterThan(0);
    await expect(page.locator('tbody').getByText(TestData.madrid.pedido).first()).toBeVisible();
  });

  test('Verificar que la búsqueda por artículo + fechas devuelve resultados', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C257' });
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.setArticulo(TestData.madrid.articulo);
    await authenticatedMadridPage.buscar();
    expect(await authenticatedMadridPage.getTotalResultCount()).toBeGreaterThan(0);
  });

  test('Verificar que Generar DBF descarga un ZIP con certificadoFirmado_ y CertificadoSellado_ del código de instalación', async ({ authenticatedMadridPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C258' });
    await authenticatedMadridPage.buscarPorFechas(desde, hasta);

    const codInstalacion = await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('th'));
      const idx = ths.findIndex(th => (th as HTMLElement).innerText.trim() === 'Cod. Instalacion');
      if (idx === -1) return '';
      const tds = Array.from(document.querySelectorAll('tbody tr:first-child td'));
      return (tds[idx] as HTMLElement)?.innerText.trim() ?? '';
    });
    expect(codInstalacion, 'no se encontró el código de instalación en la tabla').not.toBe('');

    await authenticatedMadridPage.selectTableRow(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      authenticatedMadridPage.btnGenerarDbf.click(),
    ]);

    const zipName = download.suggestedFilename();
    expect(zipName, 'nombre del ZIP inesperado').toMatch(/^lote_\d+\.zip$/i);

    mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const zipPath = join(DOWNLOADS_DIR, zipName);
    await download.saveAs(zipPath);

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries().map(e => e.entryName);

    const firmado = entries.find(n => /certificadoFirmado_/i.test(n));
    const sellado = entries.find(n => /CertificadoSellado_/i.test(n));

    expect(firmado,  `falta certificadoFirmado_ en el ZIP. Entradas: ${entries}`).toBeTruthy();
    expect(sellado,  `falta CertificadoSellado_ en el ZIP. Entradas: ${entries}`).toBeTruthy();
    expect(firmado).toContain(codInstalacion);
    expect(sellado).toContain(codInstalacion);
  });

});
