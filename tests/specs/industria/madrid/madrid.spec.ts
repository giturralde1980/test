import { test, expect } from '../../../fixtures/base.fixture';
import { TestData } from '../../../helpers/test-data';

test.describe('Madrid - Dashboard de inspecciones', () => {
  test.describe('Carga inicial', () => {
    test('la página carga correctamente tras login', async ({ authenticatedMadridPage: _auth, page }) => {
      await expect(page).toHaveURL(/\/madrid/);
      await expect(page).toHaveTitle('INDUSTRIA');
    });

    test('muestra el encabezado INDUSTRIA MADRID', async ({ authenticatedMadridPage: _auth, page }) => {
      await expect(page.locator('text=INDUSTRIA MADRID')).toBeVisible();
    });

    test('el botón SALIR está visible', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.btnSalir).toBeVisible();
    });
  });

  test.describe('Filtros de tipo de actuación', () => {
    test('el botón Periódicas está visible y activo por defecto', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.btnPeriodicas).toBeVisible();
      await expect(authenticatedMadridPage.btnPeriodicas).toHaveClass(/v-btn--active/);
    });

    test('el botón Corrección de defectos está visible', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.btnCorreccionDefectos).toBeVisible();
    });

    test('Corrección de defectos se activa al hacer clic y desactiva Periódicas', async ({ authenticatedMadridPage }) => {
      await authenticatedMadridPage.btnCorreccionDefectos.click();
      await expect(authenticatedMadridPage.btnCorreccionDefectos).toHaveClass(/v-btn--active/);
      await expect(authenticatedMadridPage.btnPeriodicas).not.toHaveClass(/v-btn--active/);
    });
  });

  test.describe('Filtros de búsqueda', () => {
    test('los campos de fecha están visibles', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.dateDesde).toBeVisible();
      await expect(authenticatedMadridPage.dateHasta).toBeVisible();
    });

    test('el campo Número de pedido está visible', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.numeroPedido).toBeVisible();
    });

    test('el filtro Artículos está visible', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.articulos).toBeVisible();
    });
  });

  test.describe('Botones de resultado (SIN DEFECTOS / LEVE / GRAVE / CRÍTICO)', () => {
    test('los cuatro botones de resultado están visibles', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.btnSinDefectos).toBeVisible();
      await expect(authenticatedMadridPage.btnLeveAReparar).toBeVisible();
      await expect(authenticatedMadridPage.btnGrave).toBeVisible();
      await expect(authenticatedMadridPage.btnCritico).toBeVisible();
    });

    test('los botones de resultado están habilitados', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.btnSinDefectos).toBeEnabled();
      await expect(authenticatedMadridPage.btnLeveAReparar).toBeEnabled();
      await expect(authenticatedMadridPage.btnGrave).toBeEnabled();
      await expect(authenticatedMadridPage.btnCritico).toBeEnabled();
    });
  });

  test.describe('Botones de acción', () => {
    test('el botón BUSCAR está visible y habilitado', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.btnBuscar).toBeVisible();
      await expect(authenticatedMadridPage.btnBuscar).toBeEnabled();
    });

    test('BUSCAR sin filtros ejecuta la búsqueda sin error', async ({ authenticatedMadridPage, page }) => {
      await authenticatedMadridPage.buscar();
      await expect(page).toHaveURL(/\/madrid/);
      const tableOrEmpty = authenticatedMadridPage.table.or(authenticatedMadridPage.noDataMessage);
      await expect(tableOrEmpty.first()).toBeVisible();
    });
  });

  test.describe('Tabla de resultados', () => {
    test('la tabla de resultados está presente', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.table).toBeVisible();
    });

    test('la tabla muestra las columnas correctas', async ({ authenticatedMadridPage }) => {
      const headers = await authenticatedMadridPage.getTableHeaders();
      for (const expected of TestData.tableHeaders) {
        expect(headers).toContain(expected);
      }
    });

    test('el selector de filas por página está presente', async ({ authenticatedMadridPage }) => {
      await expect(authenticatedMadridPage.rowsPerPageInput).toBeVisible();
    });
  });

  test.describe('Navegación', () => {
    test('SALIR redirige a la pantalla de login', async ({ authenticatedMadridPage, page }) => {
      await authenticatedMadridPage.salir();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('#user')).toBeVisible();
    });
  });
});
