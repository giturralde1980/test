# Industria QA — Playwright + TypeScript

Suite de automatización UI para [http://industriatest.ocaicp.com](http://industriatest.ocaicp.com).  
Stack: **Playwright · TypeScript · Chromium**

---

## Requisitos

- Node.js 18+
- npm 9+

---

## Instalación

```bash
npm install
npx playwright install chromium
```

---

## Ejecución

| Comando | Descripción |
|---|---|
| `npm test` | Corre todos los tests (modo según `.env`) |
| `npm run test:headed` | Corre los tests con navegador visible |
| `npm run test:full` | Tests + genera `summary.html` |
| `npm run test:full:headed` | Tests con navegador + summary |
| `npm run test:ui` | Abre la UI interactiva de Playwright |
| `npm run test:debug` | Modo debug paso a paso |
| `npm run report:summary` | Genera `summary.html` del último run |

> **Si PowerShell bloquea los scripts `npm`**, usar `npx` directamente:
>
> ```bash
> npx playwright test                    # headless
> npx playwright test --headed           # con navegador visible
> npx playwright test --headed --debug   # paso a paso con navegador
> npx playwright test tests/specs/login.spec.ts --headed  # un archivo
> ```

### Correr un archivo o grupo específico

```bash
npx playwright test tests/specs/login.spec.ts
npx playwright test tests/specs/andalucia.spec.ts
npx playwright test --grep "Desplegables"
```

---

## Estructura del proyecto

```
industria/
├── tests/
│   ├── specs/
│   │   ├── login.spec.ts          # Tests de la pantalla de login
│   │   └── andalucia.spec.ts      # Tests del dashboard de inspecciones
│   ├── pages/
│   │   ├── BasePage.ts            # Clase base con métodos comunes
│   │   ├── LoginPage.ts           # Page Object — Login
│   │   └── AndaluciaPage.ts       # Page Object — Dashboard Andalucía
│   ├── fixtures/
│   │   └── base.fixture.ts        # Fixtures (loginPage, andaluciaPage, authenticatedPage)
│   └── helpers/
│       └── test-data.ts           # Datos de prueba y constantes
├── reports/                       # Reportes HTML y screenshots (gitignored)
├── playwright.config.ts           # Configuración de Playwright
├── tsconfig.json
└── package.json
```

---

## Cobertura de tests (32 tests)

### Login — `login.spec.ts`

| Test | Descripción |
|---|---|
| Formulario de login visible | Usuario, contraseña y botón LOGIN presentes |
| Título de la página | Verifica `<title>INDUSTRIA</title>` |
| Login con usuario válido | Redirige a `/andalucia` |
| Campo usuario acepta texto | Interacción con el input |
| Login sin usuario permanece en login | Validación de campo requerido |
| Botón LOGIN habilitado | Estado del botón |

### Dashboard Andalucía — `andalucia.spec.ts`

**Carga inicial**

| Test | Descripción |
|---|---|
| Página carga correctamente tras login | URL `/andalucia` y título correcto |
| Encabezado INDUSTRIA ANDALUCIA visible | Texto principal de la página |
| Botón SALIR visible | Presente en la cabecera |

**Filtros de búsqueda**

| Test | Descripción |
|---|---|
| Campos de fecha visibles | `Fecha inicio desde` y `Fecha inicio hasta` |
| Campo Número de pedido visible | Filtro de texto libre |
| Delegación, Inspector y Tipo de tramitación visibles | Desplegables presentes |
| Artículos visible | Desplegable de artículos |
| Número de pedido acepta texto | Interacción y limpieza del campo |
| Date picker con atributos correctos | `readonly` + `aria-haspopup=true` |

**Botones de resultado**

| Test | Descripción |
|---|---|
| Los 4 botones visibles | SIN DEFECTOS, LEVE A REPARAR, GRAVE, CRÍTICO |
| Los 4 botones habilitados | Estado `enabled` |
| Clic activa el botón (cambio visual) | Clase `v-btn--active` añadida por Vuetify |
| Segundo clic desactiva (toggle) | Clase `v-btn--active` removida |
| Múltiples botones activos simultáneamente | Selección independiente de filtros |

**Botones de acción**

| Test | Descripción |
|---|---|
| BUSCAR visible y habilitado | Estado del botón |
| BUSCAR sin filtros no genera error | Permanece en `/andalucia`, tabla visible |
| GENERAR XML visible y habilitado | Estado del botón |
| GENERAR XML sin datos → alerta | `window.alert`: _"Debe seleccionar al menos una inspección."_ |

**Desplegables — contenido**

| Test | Descripción |
|---|---|
| Tipo de tramitación contiene ALTA y RESULTADO | Verifica las dos opciones exactas |
| Inspector no está vacío | Al menos una opción disponible |
| Delegación no está vacía | Al menos una opción disponible |

**Tabla de resultados**

| Test | Descripción |
|---|---|
| Tabla presente | Componente `v-data-table` visible |
| Columnas correctas | Pedido, Línea, Nº SIOCA, Fecha Inspección, Resultado, Articulo, Cod. Instalacion, Dir. Instalacion, Estado Inspeccion, Estado Tramitacion |
| Mensaje "No data available" | Visible cuando no hay resultados |
| Selector de filas por página | Control de paginación presente |

**Navegación**

| Test | Descripción |
|---|---|
| SALIR redirige al login | Vuelve a `/` y muestra el formulario de login |

---

## Credenciales de prueba

| Campo | Valor |
|---|---|
| Usuario | `adminand` |
| Contraseña | _(vacía)_ |

Configurables en `tests/helpers/test-data.ts` o via variable de entorno `BASE_URL`.

---

## Configuración de entorno

Copiar `.env.example` a `.env` para sobreescribir la URL base:

```bash
cp .env.example .env
```

```env
BASE_URL=http://industriatest.ocaicp.com
```

---

## Reportes

Cada ejecución genera dos reportes en paralelo:

| Reporte | Ubicación | Uso |
|---|---|---|
| HTML interactivo | `reports/html/` | Revisión local |
| JUnit XML | `reports/junit/results.xml` | Integración CI / Xray |

```bash
npm run report   # abre el reporte HTML en el navegador
```

> Los reportes están en `.gitignore` — se generan en cada run y no se versionan.

---

## Integración con Jira Xray Cloud

### Configuración inicial (una sola vez)

1. En Jira: **Xray → API Keys → Generate a pair of Client ID / Client Secret**
2. Copiar los valores al `.env`:

```env
XRAY_CLIENT_ID=tu_client_id
XRAY_CLIENT_SECRET=tu_client_secret
XRAY_PROJECT_KEY=PROJ
JIRA_BASE_URL=https://tu-empresa.atlassian.net
```

### Uso

```bash
# Correr tests e importar a Xray en un solo comando
npx playwright test && npx ts-node scripts/xray-import.ts

# O con npm (si no hay restricción de PowerShell)
npm run test:xray

# Solo importar (si los tests ya corrieron)
npx ts-node scripts/xray-import.ts
```

### Comportamiento en Xray

| Ejecución | Resultado |
|---|---|
| Primera vez | Crea 33 Test Cases + Test Execution #1 |
| Segunda vez | Reutiliza los 33 Test Cases + crea Test Execution #2 |
| Nth vez | Siempre reutiliza Test Cases, acumula historial |

> Xray identifica cada test por `classname + name` del XML. Mientras no cambies el nombre del test en el código, el historial se acumula correctamente.

### Vincular a Test Cases existentes (opcional)

Si ya tenés Test Cases en Xray, agregá la key como anotación:

```typescript
test('login con usuario válido redirige a /andalucia', async ({ loginPage, page }) => {
  test.info().annotations.push({ type: 'test_key', value: 'TEST-123' });
  // ...
});
```
