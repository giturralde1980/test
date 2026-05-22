import { test, expect } from '../fixtures/base.fixture';
import { TestData } from '../helpers/test-data';

test.describe('Andalucía - Dashboard de inspecciones', () => {
  test.describe('Carga inicial', () => {
    test('la página carga correctamente tras login', async ({ authenticatedPage: _auth, page }) => {
      await expect(page).toHaveURL(/\/andalucia/);
      await expect(page).toHaveTitle('INDUSTRIA');
    });

    test('muestra el encabezado INDUSTRIA ANDALUCIA', async ({ authenticatedPage: _auth, page }) => {
      await expect(page.locator('text=INDUSTRIA ANDALUCIA')).toBeVisible();
    });

    test('el botón SALIR está visible', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.btnSalir).toBeVisible();
    });
  });

  test.describe('Filtros de búsqueda', () => {
    test('los campos de fecha están visibles', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.dateDesde).toBeVisible();
      await expect(authenticatedPage.dateHasta).toBeVisible();
    });

    test('el campo Número de pedido está visible', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.numeroPedido).toBeVisible();
    });

    test('los filtros Delegación, Inspector y Tipo de tramitación están visibles', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.delegacion).toBeVisible();
      await expect(authenticatedPage.inspector).toBeVisible();
      await expect(authenticatedPage.tipoTramitacion).toBeVisible();
    });

    test('el filtro Artículos está visible', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.articulos).toBeVisible();
    });

    test('se puede escribir en el campo Número de pedido', async ({ authenticatedPage }) => {
      await authenticatedPage.numeroPedido.fill('12345');
      await expect(authenticatedPage.numeroPedido).toHaveValue('12345');
      await authenticatedPage.numeroPedido.clear();
    });

    test('el campo Fecha inicio desde es un date picker (readonly, con aria-haspopup)', async ({ authenticatedPage }) => {
      // El campo es readonly — la fecha se selecciona via calendar picker
      await expect(authenticatedPage.dateDesde).toBeVisible();
      await expect(authenticatedPage.dateDesde).toHaveAttribute('readonly');
      await expect(authenticatedPage.dateDesde).toHaveAttribute('aria-haspopup', 'true');
    });
  });

  test.describe('Botones de resultado (SIN DEFECTOS / LEVE / GRAVE / CRÍTICO)', () => {
    test('hay exactamente 4 botones de resultado con el texto correcto', async ({ authenticatedPage: _auth, page }) => {
      const buttons = page.locator('.v-btn-toggle button').filter({ hasText: /\S+/ });
      await expect(buttons).toHaveCount(4);
      await expect(buttons.nth(0)).toHaveText('Sin defectos');
      await expect(buttons.nth(1)).toHaveText('Leve a reparar');
      await expect(buttons.nth(2)).toHaveText('Grave');
      await expect(buttons.nth(3)).toHaveText('Crítico');
    });

    test('los cuatro botones de resultado están visibles', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.btnSinDefectos).toBeVisible();
      await expect(authenticatedPage.btnLeveAReparar).toBeVisible();
      await expect(authenticatedPage.btnGrave).toBeVisible();
      await expect(authenticatedPage.btnCritico).toBeVisible();
    });

    test('los botones de resultado están habilitados', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.btnSinDefectos).toBeEnabled();
      await expect(authenticatedPage.btnLeveAReparar).toBeEnabled();
      await expect(authenticatedPage.btnGrave).toBeEnabled();
      await expect(authenticatedPage.btnCritico).toBeEnabled();
    });

    test('al hacer clic los botones se activan (cambian de estado visual)', async ({ authenticatedPage }) => {
      const buttons = [
        authenticatedPage.btnSinDefectos,
        authenticatedPage.btnLeveAReparar,
        authenticatedPage.btnGrave,
        authenticatedPage.btnCritico,
      ];
      for (const btn of buttons) {
        // Estado inicial: sin clase activa
        await expect(btn).not.toHaveClass(/v-btn--active/);
        await btn.click();
        // Tras el click: clase v-btn--active añadida por Vuetify
        await expect(btn).toHaveClass(/v-btn--active/);
      }
    });

    test('los botones de resultado son toggle: segundo clic los desactiva', async ({ authenticatedPage }) => {
      const btn = authenticatedPage.btnSinDefectos;
      await btn.click();
      await expect(btn).toHaveClass(/v-btn--active/);
      await btn.click();
      await expect(btn).not.toHaveClass(/v-btn--active/);
    });

    test('se pueden activar múltiples botones de resultado simultáneamente', async ({ authenticatedPage }) => {
      await authenticatedPage.btnSinDefectos.click();
      await authenticatedPage.btnGrave.click();
      await expect(authenticatedPage.btnSinDefectos).toHaveClass(/v-btn--active/);
      await expect(authenticatedPage.btnGrave).toHaveClass(/v-btn--active/);
      // Los no clickeados permanecen inactivos
      await expect(authenticatedPage.btnLeveAReparar).not.toHaveClass(/v-btn--active/);
      await expect(authenticatedPage.btnCritico).not.toHaveClass(/v-btn--active/);
    });
  });

  test.describe('Botones de acción', () => {
    test('el botón BUSCAR está visible y habilitado', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.btnBuscar).toBeVisible();
      await expect(authenticatedPage.btnBuscar).toBeEnabled();
    });

    test('el botón GENERAR XML está visible y habilitado', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.btnGenerarXml).toBeVisible();
      await expect(authenticatedPage.btnGenerarXml).toBeEnabled();
    });

    test('GENERAR XML sin inspecciones seleccionadas muestra alerta de validación', async ({ authenticatedPage, page }) => {
      let dialogMessage = '';
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });
      await authenticatedPage.btnGenerarXml.click();
      await page.waitForTimeout(500);
      expect(dialogMessage).toBe('Debe seleccionar al menos una inspección.');
    });

    test('BUSCAR sin filtros ejecuta la búsqueda sin error', async ({ authenticatedPage, page }) => {
      await authenticatedPage.buscar();
      await expect(page).toHaveURL(/\/andalucia/);
      const tableOrEmpty = authenticatedPage.table.or(authenticatedPage.noDataMessage);
      await expect(tableOrEmpty.first()).toBeVisible();
    });
  });

  test.describe('Desplegables - contenido', () => {
    test('Tipo de tramitación contiene las opciones ALTA y RESULTADO', async ({ authenticatedPage, page }) => {
      await authenticatedPage.tipoTramitacion.click();
      await page.waitForTimeout(400);
      const options = page.locator('.menuable__content__active .v-list-item__title');
      const texts = await options.allInnerTexts();
      expect(texts).toContain('ALTA');
      expect(texts).toContain('RESULTADO');
      await page.keyboard.press('Escape');
    });

    test('Inspector no está vacío: muestra al menos una opción', async ({ authenticatedPage, page }) => {
      await authenticatedPage.inspector.click();
      await page.waitForTimeout(400);
      const options = page.locator('.menuable__content__active .v-list-item__title');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
      await page.keyboard.press('Escape');
    });

    test('Delegación no está vacía: muestra al menos una opción', async ({ authenticatedPage, page }) => {
      await authenticatedPage.delegacion.click();
      await page.waitForTimeout(400);
      const options = page.locator('.menuable__content__active .v-list-item__title');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
      await page.keyboard.press('Escape');
    });
  });

  test.describe('Tabla de resultados', () => {
    test('la tabla de resultados está presente', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.table).toBeVisible();
    });

    test('la tabla muestra las columnas correctas', async ({ authenticatedPage }) => {
      const headers = await authenticatedPage.getTableHeaders();
      for (const expected of TestData.tableHeaders) {
        expect(headers).toContain(expected);
      }
    });

    test('muestra "No data available" cuando no hay resultados', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.noDataMessage).toBeVisible();
    });

    test('el selector de filas por página está presente', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.rowsPerPageInput).toBeVisible();
    });
  });

  test.describe('Navegación', () => {
    test('SALIR redirige a la pantalla de login', async ({ authenticatedPage, page }) => {
      await authenticatedPage.salir();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('#user')).toBeVisible();
    });
  });
});
