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
  await test.step(`Informar fecha desde: ${desde}`, () => page.setDateViaCalendar(page.dateDesde, desde));
  await test.step(`Informar fecha hasta: ${hasta}`, () => page.setDateViaCalendar(page.dateHasta, hasta));
}

test.describe('Madrid - Búsqueda por fechas 08-09 enero 2026', () => {
  test.describe.configure({ timeout: process.env.CI ? 120_000 : 90_000 });

  test('Verificar que la búsqueda básica por fechas con Periódicas activo devuelve 37 registros', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C250' });
    await expect(authenticatedMadridPage.btnPeriodicas).toHaveClass(/v-btn--active/);
    await authenticatedMadridPage.buscarPorFechas(desde, hasta);
    const count = await authenticatedMadridPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.periodicas})`, () => {
      expect(count).toBe(totales.periodicas);
    });
  });

  test('Verificar que el filtro Corrección de Defectos + fechas devuelve 56 registros', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C251' });
    await test.step('Clic en botón "Corrección de Defectos"', () => authenticatedMadridPage.btnCorreccionDefectos.click());
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.buscar();
    const count = await authenticatedMadridPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.correccionDefectos})`, () => {
      expect(count).toBe(totales.correccionDefectos);
    });
  });

  test('Verificar que el filtro Sin Defectos + fechas devuelve 17 registros', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C252' });
    await setFechas(authenticatedMadridPage);
    await test.step('Clic en botón "SIN DEFECTOS"', () => authenticatedMadridPage.btnSinDefectos.click());
    await authenticatedMadridPage.buscar();
    const count = await authenticatedMadridPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.sinDefectos})`, () => {
      expect(count).toBe(totales.sinDefectos);
    });
  });

  test('Verificar que el filtro Leve a Reparar + fechas devuelve 0 registros y la tabla aparece vacía', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C253' });
    await setFechas(authenticatedMadridPage);
    await test.step('Clic en botón "LEVE A REPARAR"', () => authenticatedMadridPage.btnLeveAReparar.click());
    await authenticatedMadridPage.buscar();
    const count = await authenticatedMadridPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.leve}) y la tabla aparece vacía`, async () => {
      expect(count).toBe(totales.leve);
      await expect(authenticatedMadridPage.noDataMessage).toBeVisible();
    });
  });

  test('Verificar que el filtro Grave + fechas devuelve 20 registros', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C254' });
    await setFechas(authenticatedMadridPage);
    await test.step('Clic en botón "GRAVE"', () => authenticatedMadridPage.btnGrave.click());
    await authenticatedMadridPage.buscar();
    const count = await authenticatedMadridPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.grave})`, () => {
      expect(count).toBe(totales.grave);
    });
  });

  test('Verificar que el filtro Crítico + fechas devuelve 0 registros y la tabla aparece vacía', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C255' });
    await setFechas(authenticatedMadridPage);
    await test.step('Clic en botón "CRÍTICO"', () => authenticatedMadridPage.btnCritico.click());
    await authenticatedMadridPage.buscar();
    const count = await authenticatedMadridPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.critico}) y la tabla aparece vacía`, async () => {
      expect(count).toBe(totales.critico);
      await expect(authenticatedMadridPage.noDataMessage).toBeVisible();
    });
  });

  test('Verificar que la búsqueda por número de pedido + fechas devuelve resultados que incluyen ese pedido', async ({ authenticatedMadridPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C256' });
    await setFechas(authenticatedMadridPage);
    await test.step(`Introducir número de pedido: ${TestData.madrid.pedido}`, () =>
      authenticatedMadridPage.numeroPedido.fill(TestData.madrid.pedido)
    );
    await authenticatedMadridPage.buscar();
    const count = await authenticatedMadridPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros e incluyen el pedido ${TestData.madrid.pedido}`, async () => {
      expect(count).toBeGreaterThan(0);
      await expect(page.locator('tbody').getByText(TestData.madrid.pedido).first()).toBeVisible();
    });
  });

  test('Verificar que la búsqueda por artículo + fechas devuelve resultados', async ({ authenticatedMadridPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C257' });
    await setFechas(authenticatedMadridPage);
    await authenticatedMadridPage.setArticulo(TestData.madrid.articulo);
    await authenticatedMadridPage.buscar();
    const count = await authenticatedMadridPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (mayor que 0)`, () => {
      expect(count).toBeGreaterThan(0);
    });
  });

  test('Verificar que Generar DBF descarga un ZIP con certificadoFirmado_ y CertificadoSellado_ del código de instalación', async ({ authenticatedMadridPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C258' });
    test.skip(!!process.env.CI, 'Descarga HTTP bloqueada por Chrome en CI — ejecutar en local');
    test.setTimeout(180_000);
    await authenticatedMadridPage.buscarPorFechas(desde, hasta);

    await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 15_000 });

    const codInstalacion = await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('th'));
      const idx = ths.findIndex(th => (th as HTMLElement).innerText.trim() === 'Cod. Instalacion');
      if (idx === -1) return '';
      const tds = Array.from(document.querySelectorAll('tbody tr:first-child td'));
      return (tds[idx] as HTMLElement)?.innerText.trim() ?? '';
    });
    expect(codInstalacion, 'no se encontró el código de instalación en la tabla').not.toBe('');

    await authenticatedMadridPage.selectTableRow(0);

    const [download] = await test.step('Clic en GENERAR DBF y descargar ZIP', () =>
      Promise.all([
        page.waitForEvent('download'),
        authenticatedMadridPage.btnGenerarDbf.click(),
      ])
    );

    const zipName = download.suggestedFilename();
    expect(zipName, 'nombre del ZIP inesperado').toMatch(/^lote_\d+\.zip$/i);

    mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const zipPath = join(DOWNLOADS_DIR, zipName);
    await download.saveAs(zipPath);

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries().map(e => e.entryName);

    await test.step(`Resultado: ZIP "${zipName}" contiene certificadoFirmado_ y CertificadoSellado_ del código ${codInstalacion}`, () => {
      const firmado = entries.find(n => /certificadoFirmado_/i.test(n));
      const sellado = entries.find(n => /CertificadoSellado_/i.test(n));

      expect(firmado,  `falta certificadoFirmado_ en el ZIP. Entradas: ${entries}`).toBeTruthy();
      expect(sellado,  `falta CertificadoSellado_ en el ZIP. Entradas: ${entries}`).toBeTruthy();
      expect(firmado).toContain(codInstalacion);
      expect(sellado).toContain(codInstalacion);
    });
  });

  test('Verificar que el desplegable Inspector está cargado con datos', async ({ authenticatedMadridPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C259' });
    await test.step('Clic en el desplegable Inspector', () => authenticatedMadridPage.inspector.click());
    const options = page.locator('.menuable__content__active .v-list-item__title');
    await options.first().waitFor({ state: 'visible', timeout: 8_000 });

    const count = await options.count();
    const texts = await options.allInnerTexts();
    await test.step(`Resultado: ${count} opción(es) cargada(s), ninguna vacía`, () => {
      expect(count, 'El desplegable Inspector no devolvió ninguna opción').toBeGreaterThan(0);
      expect(texts.every(t => t.trim().length > 0), 'Alguna opción de Inspector aparece vacía').toBe(true);
    });

    await page.keyboard.press('Escape');
  });

});
