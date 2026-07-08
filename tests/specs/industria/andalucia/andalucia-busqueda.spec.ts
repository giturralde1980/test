import { test, expect } from '../../../fixtures/base.fixture';
import { TestData } from '../../../helpers/test-data';
import { AndaluciaPage } from '../../../pages/AndaluciaPage';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DOWNLOADS_DIR = join(process.cwd(), 'reports', 'downloads');

const { desde, hasta } = TestData.busquedas.fechas;
const totales = TestData.busquedas.totales;

async function setFechas(page: AndaluciaPage): Promise<void> {
  await page.btnBuscar.waitFor({ state: 'visible' });
  await test.step(`Informar fecha desde: ${desde}`, () => page.setDateViaCalendar(page.dateDesde, desde));
  await test.step(`Informar fecha hasta: ${hasta}`, () => page.setDateViaCalendar(page.dateHasta, hasta));
}

// Extrae el valor de texto de un tag XML (primera ocurrencia)
function xmlValue(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : '';
}

// Comprueba que un tag existe en el XML
function xmlHas(xml: string, tag: string): boolean {
  return new RegExp(`<${tag}[\\s/>]`).test(xml);
}

test.describe('Andalucía - Búsqueda por fechas 08-09 enero 2026', () => {
  test.describe.configure({ timeout: process.env.CI ? 120_000 : 60_000 });

  test('Verificar que la búsqueda por fechas 08-09 ene 2026 devuelve 165 registros', async ({ authenticatedPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C46' });
    await authenticatedPage.buscarPorFechas(desde, hasta);
    const count = await authenticatedPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.porFechas})`, () => {
      expect(count).toBe(totales.porFechas);
    });
  });

  test('Verificar que el filtro Sin Defectos + fechas devuelve 100 registros', async ({ authenticatedPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C47' });
    await setFechas(authenticatedPage);
    await test.step('Clic en botón "SIN DEFECTOS"', () => authenticatedPage.btnSinDefectos.click());
    await authenticatedPage.buscar();
    const count = await authenticatedPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.sinDefectos})`, () => {
      expect(count).toBe(totales.sinDefectos);
    });
  });

  test('Verificar que el filtro Leve a Reparar + fechas devuelve 33 registros', async ({ authenticatedPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C48' });
    await setFechas(authenticatedPage);
    await test.step('Clic en botón "LEVE A REPARAR"', () => authenticatedPage.btnLeveAReparar.click());
    await authenticatedPage.buscar();
    const count = await authenticatedPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.leve})`, () => {
      expect(count).toBe(totales.leve);
    });
  });

  test('Verificar que el filtro Grave + fechas devuelve 32 registros', async ({ authenticatedPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C49' });
    await setFechas(authenticatedPage);
    await test.step('Clic en botón "GRAVE"', () => authenticatedPage.btnGrave.click());
    await authenticatedPage.buscar();
    const count = await authenticatedPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.grave})`, () => {
      expect(count).toBe(totales.grave);
    });
  });

  test('Verificar que el filtro Crítico + fechas devuelve 0 registros y la tabla aparece vacía', async ({ authenticatedPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C50' });
    await setFechas(authenticatedPage);
    await test.step('Clic en botón "CRÍTICO"', () => authenticatedPage.btnCritico.click());
    await authenticatedPage.buscar();
    const count = await authenticatedPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.critico}) y la tabla aparece vacía`, async () => {
      expect(count).toBe(totales.critico);
      await expect(authenticatedPage.noDataMessage).toBeVisible();
    });
  });

  test('Verificar que la búsqueda por número de pedido + fechas devuelve resultados que incluyen ese pedido', async ({ authenticatedPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C51' });
    await setFechas(authenticatedPage);
    await test.step(`Introducir número de pedido: ${TestData.busquedas.pedido}`, () =>
      authenticatedPage.numeroPedido.fill(TestData.busquedas.pedido)
    );
    await authenticatedPage.buscar();
    const count = await authenticatedPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros e incluyen el pedido ${TestData.busquedas.pedido}`, async () => {
      expect(count).toBeGreaterThan(0);
      await expect(page.locator('tbody').getByText(TestData.busquedas.pedido).first()).toBeVisible();
    });
  });

  test('Verificar que la búsqueda por artículo + fechas devuelve 6 registros', async ({ authenticatedPage }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C52' });
    await setFechas(authenticatedPage);
    await authenticatedPage.setArticulo(TestData.busquedas.articulo);
    await authenticatedPage.buscar();
    const count = await authenticatedPage.getTotalResultCount();
    await test.step(`Resultado: se reciben ${count} registros (esperado: ${totales.articulo})`, () => {
      expect(count).toBe(totales.articulo);
    });
  });

  test('Verificar que al generar XML se descarga un fichero SIOCA_YYYYMMDD_HHMMSS.xml', async ({ authenticatedPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C53' });
    test.skip(!!process.env.CI, 'Descarga HTTP bloqueada por Chrome en CI — ejecutar en local');
    test.setTimeout(120_000);
    await authenticatedPage.buscarPorFechas(desde, hasta);
    await authenticatedPage.selectTableRow(0);

    const [download] = await test.step('Clic en GENERAR XML y descargar fichero', () =>
      Promise.all([
        page.waitForEvent('download'),
        authenticatedPage.btnGenerarXml.click(),
      ])
    );

    const filename = download.suggestedFilename();
    await test.step(`Resultado: fichero descargado "${filename}"`, async () => {
      expect(filename).toMatch(/^SIOCA_\d{8}_\d{6}\.xml$/i);
      mkdirSync(DOWNLOADS_DIR, { recursive: true });
      await download.saveAs(join(DOWNLOADS_DIR, filename));
    });
  });

  test('Verificar que el XML generado tiene estructura y contenido válidos', async ({ authenticatedPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C54' });
    test.skip(!!process.env.CI, 'Descarga HTTP bloqueada por Chrome en CI — ejecutar en local');
    test.setTimeout(120_000);
    await authenticatedPage.buscarPorFechas(desde, hasta);
    await authenticatedPage.selectTableRow(0);

    const [download] = await test.step('Clic en GENERAR XML y descargar fichero', () =>
      Promise.all([
        page.waitForEvent('download'),
        authenticatedPage.btnGenerarXml.click(),
      ])
    );

    mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const xmlPath = join(DOWNLOADS_DIR, download.suggestedFilename());
    await download.saveAs(xmlPath);

    const xml = readFileSync(xmlPath, 'utf8');

    await test.step('Validar estructura del XML (15 etiquetas obligatorias)', () => {
      expect(xmlHas(xml, 'sioca'),            'falta raíz <sioca>').toBe(true);
      expect(xmlHas(xml, 'comunicaciones'),   'falta <comunicaciones>').toBe(true);
      expect(xmlHas(xml, 'comunicacion'),     'falta <comunicacion>').toBe(true);
      expect(xmlHas(xml, 'tipo'),             'falta <tipo>').toBe(true);
      expect(xmlHas(xml, 'inspeccion'),       'falta <inspeccion>').toBe(true);
      expect(xmlHas(xml, 'instalacion'),      'falta <instalacion>').toBe(true);
      expect(xmlHas(xml, 'certificado'),      'falta <certificado>').toBe(true);
      expect(xmlHas(xml, 'fecha'),            'falta <fecha>').toBe(true);
      expect(xmlHas(xml, 'reglamento'),       'falta <reglamento>').toBe(true);
      expect(xmlHas(xml, 'duracion'),         'falta <duracion>').toBe(true);
      expect(xmlHas(xml, 'inspector'),        'falta <inspector>').toBe(true);
      expect(xmlHas(xml, 'titular'),          'falta <titular>').toBe(true);
      expect(xmlHas(xml, 'domicilio'),        'falta <domicilio>').toBe(true);
      expect(xmlHas(xml, 'tipo_documentacion'), 'falta <tipo_documentacion>').toBe(true);
      expect(xmlHas(xml, 'numero_documentacion'), 'falta <numero_documentacion>').toBe(true);
    });

    await test.step('Resultado: validar contenido del XML (tipo, fecha, certificado, titular, documentación)', () => {
      const tipo = xmlValue(xml, 'tipo');
      expect(['ALTA', 'RESULTADO'], `<tipo> inválido: "${tipo}"`).toContain(tipo);

      const certificado = xmlValue(xml, 'certificado');
      expect(certificado, '<certificado> vacío').not.toBe('');

      const fecha = xmlValue(xml, 'fecha');
      expect(fecha, `<fecha> no tiene formato DD/MM/YYYY: "${fecha}"`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

      const [d, m, y] = fecha.split('/').map(Number);
      const fechaDate  = new Date(y, m - 1, d);
      const desdeDate  = new Date(2026, 0, 8);
      const hastaDate  = new Date(2026, 0, 9);
      expect(fechaDate.getTime(), `<fecha> ${fecha} fuera del rango de búsqueda`).toBeGreaterThanOrEqual(desdeDate.getTime());
      expect(fechaDate.getTime(), `<fecha> ${fecha} fuera del rango de búsqueda`).toBeLessThanOrEqual(hastaDate.getTime());

      const duracion = parseInt(xmlValue(xml, 'duracion'), 10);
      expect(Number.isNaN(duracion), '<duracion> no es un número').toBe(false);
      expect(duracion, '<duracion> negativa').toBeGreaterThanOrEqual(0);

      const nombreTitular = xmlValue(xml, 'nombre');
      expect(nombreTitular, '<titular><nombre> vacío').not.toBe('');

      const numDoc = xmlValue(xml, 'numero_documentacion');
      expect(numDoc, '<numero_documentacion> vacío').not.toBe('');

      const tipoDoc = xmlValue(xml, 'tipo_documentacion');
      expect(['CIF', 'NIF', 'NIE', 'PASAPORTE'], `<tipo_documentacion> desconocido: "${tipoDoc}"`).toContain(tipoDoc);
    });
  });

  test('Verificar que el desplegable Inspector está cargado con datos', async ({ authenticatedPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C55' });
    await test.step('Clic en el desplegable Inspector', () => authenticatedPage.inspector.click());
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

  test('Verificar que el desplegable Delegación está cargado con datos', async ({ authenticatedPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C56' });
    await test.step('Clic en el desplegable Delegación', () => authenticatedPage.delegacion.click());
    const options = page.locator('.menuable__content__active .v-list-item__title');
    await options.first().waitFor({ state: 'visible', timeout: 8_000 });

    const count = await options.count();
    const texts = await options.allInnerTexts();
    await test.step(`Resultado: ${count} opción(es) cargada(s), ninguna vacía`, () => {
      expect(count, 'El desplegable Delegación no devolvió ninguna opción').toBeGreaterThan(0);
      expect(texts.every(t => t.trim().length > 0), 'Alguna opción de Delegación aparece vacía').toBe(true);
    });

    await page.keyboard.press('Escape');
  });

  test('Verificar que el desplegable Provincia está cargado con datos', async ({ authenticatedPage, page }) => {
    test.info().annotations.push({ type: 'testrail', description: 'C57' });
    await test.step('Clic en el desplegable Provincia', () => authenticatedPage.provincia.click());
    const options = page.locator('.menuable__content__active .v-list-item__title');
    await options.first().waitFor({ state: 'visible', timeout: 8_000 });

    const count = await options.count();
    const texts = await options.allInnerTexts();
    await test.step(`Resultado: ${count} opción(es) cargada(s), ninguna vacía`, () => {
      expect(count, 'El desplegable Provincia no devolvió ninguna opción').toBeGreaterThan(0);
      expect(texts.every(t => t.trim().length > 0), 'Alguna opción de Provincia aparece vacía').toBe(true);
    });

    await page.keyboard.press('Escape');
  });

});
