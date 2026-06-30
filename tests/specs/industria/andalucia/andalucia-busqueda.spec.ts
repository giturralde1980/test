import { test, expect } from '../../../fixtures/base.fixture';
import { TestData } from '../../../helpers/test-data';
import { AndaluciaPage } from '../../../pages/AndaluciaPage';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DOWNLOADS_DIR = join(process.cwd(), 'reports', 'downloads');

const { desde, hasta } = TestData.busquedas.fechas;
const totales = TestData.busquedas.totales;

async function setFechas(page: AndaluciaPage): Promise<void> {
  await page.setDateViaCalendar(page.dateDesde, desde);
  await page.setDateViaCalendar(page.dateHasta, hasta);
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

    mkdirSync(DOWNLOADS_DIR, { recursive: true });
    await download.saveAs(join(DOWNLOADS_DIR, filename));
  });

  test('XML generado tiene estructura y contenido válidos', async ({ authenticatedPage, page }) => {
    // Descargar XML
    await authenticatedPage.buscarPorFechas(desde, hasta);
    await authenticatedPage.selectTableRow(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      authenticatedPage.btnGenerarXml.click(),
    ]);

    mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const xmlPath = join(DOWNLOADS_DIR, download.suggestedFilename());
    await download.saveAs(xmlPath);

    const xml = readFileSync(xmlPath, 'utf8');

    // ── 1. Estructura ────────────────────────────────────────────────────────
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

    // ── 2. Contenido ─────────────────────────────────────────────────────────

    // tipo es ALTA o RESULTADO
    const tipo = xmlValue(xml, 'tipo');
    expect(['ALTA', 'RESULTADO'], `<tipo> inválido: "${tipo}"`).toContain(tipo);

    // certificado no vacío
    const certificado = xmlValue(xml, 'certificado');
    expect(certificado, '<certificado> vacío').not.toBe('');

    // fecha en formato DD/MM/YYYY
    const fecha = xmlValue(xml, 'fecha');
    expect(fecha, `<fecha> no tiene formato DD/MM/YYYY: "${fecha}"`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    // fecha dentro del rango de búsqueda (08/01/2026 – 09/01/2026)
    const [d, m, y] = fecha.split('/').map(Number);
    const fechaDate  = new Date(y, m - 1, d);
    const desdeDate  = new Date(2026, 0, 8);
    const hastaDate  = new Date(2026, 0, 9);
    expect(fechaDate.getTime(), `<fecha> ${fecha} fuera del rango de búsqueda`).toBeGreaterThanOrEqual(desdeDate.getTime());
    expect(fechaDate.getTime(), `<fecha> ${fecha} fuera del rango de búsqueda`).toBeLessThanOrEqual(hastaDate.getTime());

    // duración es un número >= 0
    const duracion = parseInt(xmlValue(xml, 'duracion'), 10);
    expect(Number.isNaN(duracion), '<duracion> no es un número').toBe(false);
    expect(duracion, '<duracion> negativa').toBeGreaterThanOrEqual(0);

    // titular: nombre y número de documentación no vacíos
    const nombreTitular = xmlValue(xml, 'nombre');
    expect(nombreTitular, '<titular><nombre> vacío').not.toBe('');

    const numDoc = xmlValue(xml, 'numero_documentacion');
    expect(numDoc, '<numero_documentacion> vacío').not.toBe('');

    // tipo_documentacion es un valor reconocido
    const tipoDoc = xmlValue(xml, 'tipo_documentacion');
    expect(['CIF', 'NIF', 'NIE', 'PASAPORTE'], `<tipo_documentacion> desconocido: "${tipoDoc}"`).toContain(tipoDoc);
  });

});
