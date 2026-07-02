# Análisis Técnico y Funcional — Proyecto QA Automation Industria

> Generado: 2026-07-02  
> Entorno: `http://industriatest.ocaicp.com`  
> Stack: Playwright 1.60+ · TypeScript · GitHub Actions (self-hosted) · TestRail

---

## 1. Arquitectura general

```
industria/
├── .github/workflows/
│   └── playwright.yml          # Pipeline CI — 2 jobs paralelos (Andalucía / Madrid)
├── reporters/
│   └── testrail.reporter.ts    # Reporter custom: crea runs por región, sube resultados
├── scripts/
│   ├── testrail-sync-andalucia.js      # Sincroniza casos C46-C54 con TestRail
│   ├── testrail-sync-madrid.js         # Sincroniza casos C250-C258 con TestRail
│   ├── testrail-mapping-andalucia.json # Mapeo caseId ↔ título (Andalucía)
│   ├── testrail-mapping-madrid.json    # Mapeo caseId ↔ título (Madrid)
│   ├── testrail-verify.js              # Verifica conectividad con TestRail
│   ├── testrail-list-suites.js         # Lista suites del proyecto TestRail
│   ├── generate-summary.js             # Genera resumen de resultados
│   ├── allure-setup.js                 # Setup para reports Allure
│   └── xray-import.ts                  # Import alternativo a Xray (no activo)
├── tests/
│   ├── fixtures/
│   │   └── base.fixture.ts     # Fixtures: loginPage, andaluciaPage, authenticatedPage, authenticatedMadridPage
│   ├── helpers/
│   │   └── test-data.ts        # Datos de prueba centralizados (credenciales, fechas, totales esperados)
│   ├── pages/
│   │   ├── BasePage.ts         # Clase base abstracta: navigate(), waitForPageLoad(), takeScreenshot()
│   │   ├── LoginPage.ts        # POM login: userInput, passwordInput, loginButton, login()
│   │   ├── AndaluciaPage.ts    # POM Andalucía: locators, buscar(), setDateViaCalendar(), getTotalResultCount()
│   │   └── MadridPage.ts       # POM Madrid: extiende AndaluciaPage, override date pickers, btnPeriodicas, btnGenerarDbf
│   ├── specs/
│   │   ├── login.spec.ts                              # Tests de login (7 casos)
│   │   └── industria/
│   │       ├── andalucia/
│   │       │   ├── andalucia.spec.ts                  # Tests UI/estructura Andalucía (~22 casos)
│   │       │   └── andalucia-busqueda.spec.ts         # Tests búsqueda + descargas Andalucía (C46-C54)
│   │       └── madrid/
│   │           ├── madrid.spec.ts                     # Tests UI/estructura Madrid (~16 casos)
│   │           └── madrid-busqueda.spec.ts            # Tests búsqueda + descarga DBF Madrid (C250-C258)
│   ├── utils/
│   │   ├── explore.ts                  # Script exploración (no forma parte de la suite)
│   │   └── explore-datepicker.spec.ts  # Spec debug date picker (no forma parte de la suite)
│   └── global-setup.ts                 # Global setup comentado (storageState no funciona con esta app)
├── playwright.config.ts        # Configuración Playwright
└── package.json                # Dependencias y scripts npm
```

---

## 2. Stack tecnológico

| Herramienta | Versión | Uso |
|---|---|---|
| `@playwright/test` | ^1.60.0 | Framework de automatización E2E |
| TypeScript | ^6.0.3 | Lenguaje principal |
| dotenvx | ^17.4.2 | Gestión de variables de entorno / secretos |
| adm-zip | ^0.5.18 | Validación de contenido de ZIPs (test C258) |
| allure-playwright | ^3.10.2 | Reporter Allure (comentado, no activo) |
| cross-env | ^10.1.0 | Variables de entorno cross-platform |
| xunit-viewer | ^10.6.1 | Generación de summary HTML desde JUnit XML |
| ts-node | ^10.9.2 | Ejecución de scripts TS directamente |
| GitHub Actions | — | CI/CD con runner self-hosted en Windows |
| TestRail (Web ID 3) | — | Gestión de casos y resultados de test |

---

## 3. Configuración Playwright (`playwright.config.ts`)

```
testDir:        ./tests
testMatch:      **/*.spec.ts
fullyParallel:  true
workers:        1              ← serialización forzada (backend no soporta concurrencia)
retries:        1              ← siempre activo (local y CI)
timeout:        CI → 120s / local → 30s  (global)
headless:       true salvo HEADLESS=false
acceptDownloads: true
launchOptions:  --disable-download-restrictions, --safebrowsing-disable-download-protection
```

**Reporters activos:** `html`, `junit`, `list`, `testrail.reporter.ts`  
**Reporter inactivo:** `allure-playwright` (comentado)

**Notas importantes:**
- `workers: 1` es intencional: el backend MuleSaft/Salesforce no tolera peticiones concurrentes con la misma sesión.
- `timeout` global de 30s en local es bajo; los describe blocks sobrecargan con `test.describe.configure({ timeout: 60s/90s/120s })`.
- Los flags de Chrome para descarga (`--disable-download-restrictions`) no tienen efecto en modo headless con HTTP — son ignorados por Chrome 111+.

---

## 4. Patrón Page Object Model

### Jerarquía de clases

```
BasePage (abstracta)
  └── LoginPage
  └── AndaluciaPage
        └── MadridPage
```

### BasePage
Clase base mínima. Provee `navigate()`, `waitForPageLoad()`, `takeScreenshot()`. Sin locators propios.

### LoginPage
Localiza por IDs estáticos (`#user`, `#password`). El método `login()` navega, rellena y hace click; luego espera `networkidle`. La contraseña es opcional (la app de pruebas no siempre la requiere).

### AndaluciaPage
La clase más compleja del proyecto. Contiene:

- **Locators de fecha** — `dateDesde` / `dateHasta` (inputs `#dateDesde`, `#dateHasta`) y sus slots para abrir el picker.
- **Locators de filtro** — `numeroPedido`, `delegacion`, `inspector`, `tipoTramitacion`, `articulos`.
- **Botones de resultado** — `btnSinDefectos`, `btnLeveAReparar`, `btnGrave`, `btnCritico`.
- **Botones de acción** — `btnBuscar`, `btnGenerarXml`.
- **`buscar()`** — hace clic en BUSCAR y espera que el loader `text=Pasito a pasito...` aparezca y desaparezca (hasta 60s/90s CI).
- **`setDateViaCalendar()`** — método más complejo del proyecto. Abre el Vuetify date picker, navega mes a mes comparando el header (texto en español "enero de 2026"), y hace clic en el día correcto. Soporta hasta 24 intentos de navegación.
- **`getTotalResultCount()`** — lee el footer de paginación Vuetify (`.v-data-footer__pagination`, patrón `of N`). Implementa polling con estabilización: requiere 2 lecturas consecutivas idénticas antes de devolver el valor. Deadline: 35s local / 45s CI.
- **`setArticulo()`** — abre el autocomplete Vuetify, escribe el valor y selecciona la primera opción del menú.

### MadridPage
Extiende `AndaluciaPage`. Los date pickers de Madrid tienen IDs generados por Vuetify (no estáticos), por lo que los locators se sobreescriben en el constructor usando labels: `.v-input:has-text("Fecha inicio inspección...desde")`. Añade `btnPeriodicas`, `btnCorreccionDefectos`, `btnGenerarDbf`.

**Punto de atención técnico:** el override de locators `readonly` se hace con `(this as any).dateDesde = ...`, lo que rompe la seguridad de tipos de TypeScript.

---

## 5. Fixtures (`base.fixture.ts`)

| Fixture | Tipo | Descripción |
|---|---|---|
| `loginPage` | test-scoped | LoginPage sin autenticar |
| `andaluciaPage` | test-scoped | AndaluciaPage sin autenticar |
| `authenticatedPage` | test-scoped | Login con credenciales Andalucía → AndaluciaPage lista |
| `authenticatedMadridPage` | test-scoped | Login con credenciales Madrid → MadridPage lista |

Todas son **test-scoped**: cada test arranca con un browser context nuevo, sesión limpia. Esto es importante para el comportamiento del retry: cuando un test se reintenta, obtiene un contexto completamente nuevo (no reutiliza el anterior).

---

## 6. Test Data (`test-data.ts`)

Centraliza todos los datos de prueba:
- **Credenciales** — leídas de variables de entorno (`TEST_USERNAME`, `TEST_PASSWORD`, `MADRID_USERNAME`, `MADRID_PASSWORD`). Nunca hardcodeadas.
- **Fechas** — `2026-01-08` a `2026-01-09` (rango fijo de 2 días para ambas regiones).
- **Totales esperados** — valores absolutos fijos que deben coincidir con el backend en esas fechas.
- **Pedidos y artículos** — números específicos para validar búsquedas por campo.
- **Headers de tabla** — listas completas de columnas esperadas para Andalucía y Madrid.

---

## 7. Suite de tests

### 7.1 Login (`login.spec.ts`) — 7 casos

| # | Caso | Tipo |
|---|---|---|
| 1 | Formulario visible (user, pass, button) | UI |
| 2 | Título de página "INDUSTRIA" | UI |
| 3 | Login válido redirige a /andalucia | Funcional |
| 4 | Campo usuario acepta texto | UI |
| 5 | Login sin usuario permanece en login | Validación |
| 6 | Botón LOGIN habilitado | UI |
| 7 | Login con usuario inválido → alerta "Campos en blanco." | Validación |

### 7.2 Andalucía UI (`andalucia.spec.ts`) — ~22 casos

Agrupados en 6 describes:
- **Carga inicial**: URL, título, botón SALIR
- **Filtros de búsqueda**: visibilidad de fechas, pedido, delegación, inspector, tipo tramitación, artículos
- **Botones de resultado**: count exacto (4), textos, toggle, multi-selección
- **Botones de acción**: BUSCAR (visible/habilitado), GENERAR XML (visible/habilitado), validación sin selección
- **Desplegables**: Tipo tramitación con ALTA/RESULTADO, Inspector y Delegación no vacíos
- **Tabla**: presente, columnas correctas, "No data available", selector de filas/página
- **Navegación**: SALIR redirige a login

### 7.3 Andalucía Búsqueda (`andalucia-busqueda.spec.ts`) — 9 casos (C46-C54)

| Caso TestRail | Test | Estado CI |
|---|---|---|
| C46 | Búsqueda básica 08-09 ene → 165 registros | ✅ activo |
| C47 | Filtro Sin Defectos → 100 registros | ✅ activo |
| C48 | Filtro Leve a Reparar → 33 registros | ✅ activo |
| C49 | Filtro Grave → 32 registros | ✅ activo |
| C50 | Filtro Crítico → 0 registros + tabla vacía | ✅ activo |
| C51 | Búsqueda por pedido → resultado incluye ese pedido | ✅ activo |
| C52 | Búsqueda por artículo → 6 registros | ✅ activo |
| C53 | Generar XML → descarga `SIOCA_YYYYMMDD_HHMMSS.xml` | ⛔ skip en CI |
| C54 | XML generado tiene estructura y contenido válidos | ⛔ skip en CI |

### 7.4 Madrid UI (`madrid.spec.ts`) — ~16 casos

Espejo funcional de `andalucia.spec.ts` adaptado a Madrid:
- **Carga inicial**: URL `/madrid`, encabezado "INDUSTRIA MADRID"
- **Filtros de tipo de actuación**: Periódicas activo por defecto, Corrección de defectos exclusivo
- **Filtros de búsqueda**: fechas, pedido, artículos
- **Botones de resultado**: visibilidad y estado habilitado
- **Botones de acción**: BUSCAR visible/habilitado, búsqueda sin filtros no da error
- **Tabla**: presente, columnas correctas, selector de filas
- **Navegación**: SALIR redirige a login

### 7.5 Madrid Búsqueda (`madrid-busqueda.spec.ts`) — 9 casos (C250-C258)

| Caso TestRail | Test | Estado CI |
|---|---|---|
| C250 | Búsqueda con Periódicas → 37 registros | ✅ activo |
| C251 | Corrección de Defectos → 56 registros | ✅ activo |
| C252 | Sin Defectos → 17 registros | ✅ activo |
| C253 | Leve a Reparar → 0 registros + tabla vacía | ✅ activo |
| C254 | Grave → 20 registros | ✅ activo |
| C255 | Crítico → 0 registros + tabla vacía | ✅ activo |
| C256 | Búsqueda por pedido → resultado incluye ese pedido | ✅ activo |
| C257 | Búsqueda por artículo → resultados > 0 | ✅ activo |
| C258 | Generar DBF → ZIP con `certificadoFirmado_` y `CertificadoSellado_` | ⛔ skip en CI |

---

## 8. Reporter TestRail (`testrail.reporter.ts`)

### Ciclo de vida

```
onBegin()
  → detectRegions(suite)          # Auto-detecta regiones por ruta de fichero
  → por cada región:
      → getCaseIdsForRegion()     # Lee mapping JSON de scripts/
      → add_run (TestRail API)    # Crea run "TE_Andalucia_YYYYMMDD_HHMM_LOC/CI"
      → get_tests                 # Obtiene case_id → test_id

onTestEnd() (por cada test)
  → busca anotación type='testrail'
  → extrae case_id del string 'CXX'
  → detecta región por ruta de fichero
  → guarda en pending Map (sobreescribe si es retry)

onEnd()
  → por cada región:
      → add_result por cada pending
      → add_attachment_to_result (screenshot si existe)
      → close_run
```

### Detección de región

- Si `TESTRAIL_RUN_PREFIX` está definido → usa ese prefijo, crea 1 run.
- Si no → escanea rutas de ficheros de todos los tests en el suite:
  - Solo Andalucía → `['TE_Andalucia']`
  - Solo Madrid → `['TE_Madrid']`
  - Ambos → `['TE_Andalucia', 'TE_Madrid']` — **crea 2 runs independientes**

### Nombre del run

```
TE_Andalucia_20260702_1040_LOC  (local)
TE_Madrid_20260702_1104_CI      (CI)
```

### Manejo de retries

El `pending` es un `Map<case_id, PendingResult>`. Si un test se reintenta, el segundo resultado sobreescribe el primero. Solo se envía el resultado final a TestRail.

---

## 9. Pipeline CI/CD (`.github/workflows/playwright.yml`)

### Triggers

- **`workflow_dispatch`**: lanzamiento manual desde GitHub UI, con selector de región (`all` / `andalucia` / `madrid`).
- **`repository_dispatch`**: lanzamiento desde sistemas externos (Jira, Postman, etc.) con `event_type: run-tests` y `client_payload.region`.

### Jobs

| Job | Condición | Runner |
|---|---|---|
| `test-andalucia` | Región ≠ `madrid` | self-hosted |
| `test-madrid` | Región ≠ `andalucia` | self-hosted |

Ambos jobs corren **en paralelo** cuando se lanza `all`. Cada uno:
1. `checkout` con `clean: true` (descarta cualquier fichero residual)
2. `npm ci` (instalación reproducible)
3. `npx playwright install --with-deps chromium` (instala browser)
4. Ejecuta el script correspondiente con secretos de GitHub
5. Sube `reports/` como artefacto (`retention-days: 7`)

### Variables de entorno en CI

| Secret | Uso |
|---|---|
| `BASE_URL` | URL del entorno de test |
| `TEST_USERNAME` / `TEST_PASSWORD` | Credenciales Andalucía |
| `MADRID_USERNAME` / `MADRID_PASSWORD` | Credenciales Madrid |
| `TESTRAIL_URL` / `TESTRAIL_USER` / `TESTRAIL_API_KEY` | TestRail API |
| `TESTRAIL_PROJECT_ID` | ID proyecto TestRail (Web, ID 3) |
| `TESTRAIL_ENABLED` | Flag `true`/`false` para activar el reporter |

---

## 10. Bugs y problemas encontrados durante el desarrollo

Esta sección documenta todos los problemas significativos encontrados, su causa raíz, impacto y solución aplicada.

---

### BUG-01 — Cold-start del backend (MuleSoft/Salesforce)

**Descripción:**
El backend de la aplicación (MuleSoft/Salesforce) tiene un comportamiento de "cold-start": cuando no ha recibido peticiones durante un período, la primera petición tarda entre 30 y 45 segundos en responder. Las peticiones siguientes son rápidas (<5s).

**Impacto:**
- C46 (Andalucía, primer test de la suite) y C250 (Madrid, primer test) fallan frecuentemente con resultado `0` porque el polling lee antes de que el servidor devuelva datos.
- El fallo es intermitente: solo ocurre cuando el servidor está frío, no en cada ejecución.

**Comportamiento observado:**
```
Attempt 1: Expected 165, Received 0    ← servidor frío
Retry #1:  Expected 165, Received 165  ← servidor caliente tras el primer intento
```

**Causa raíz:** El estado "frío/caliente" es global en el servidor. Cualquier petición (incluso la fallida del primer intento) calienta el servidor para las siguientes.

**Solución aplicada:**
- `retries: 1` siempre activo → el primer intento calienta el servidor; el retry ya tiene respuesta rápida.
- Polling extendido: 35s local / 45s CI en `getTotalResultCount()`.

**Limitación residual:** Si el cold-start supera 45s (casos extremos), el retry también fallará. No hay garantía del 100%.

---

### BUG-02 — Lectura de count parcial (batch loading)

**Descripción:**
El servidor devuelve los resultados de búsqueda en batches. El paginador Vuetify actualiza el texto `of N` con el count parcial antes de que carguen todos los registros.

**Impacto:**
- Tests fallan con valores ligeramente incorrectos aunque los datos en el servidor son correctos.
- Ejemplos observados: `98` en lugar de `100`, `163` en lugar de `165`.
- El fallo es **consistente** en las mismas condiciones (no es aleatorio), lo que lo diferencia del BUG-01.

**Causa raíz:** La lógica original de `getTotalResultCount()` usaba:
```typescript
if (count > 0) return count; // ← salía en el primer valor > 0
```
El primer batch llegaba con 98 registros, el código lo devolvía inmediatamente, y los 2 restantes llegaban milisegundos después.

**Solución aplicada:**
```typescript
// Requiere 2 lecturas consecutivas idénticas
if (count > 0 && count === prevCount) return count;
prevCount = count;
```
Añade máximo 500ms de espera extra por test (un tick de confirmación).

---

### BUG-03 — Descarga de ficheros HTTP bloqueada en CI (headless)

**Descripción:**
Chrome 111+ en modo headless bloquea las descargas de ficheros sobre HTTP (sin TLS). Los tests C53, C54 (XML Andalucía) y C258 (DBF Madrid) fallan en CI porque el entorno de test usa HTTP sin certificado.

**Impacto:** 3 tests de 18 no pueden ejecutarse en CI.

**Intentos fallidos:**
- `--disable-download-restrictions` en `launchOptions` → ignorado en headless.
- `--safebrowsing-disable-download-protection` → ignorado en headless.
- Cambiar a `headless: false` en CI → no viable en runner self-hosted sin display.

**Causa raíz:** Cambio de seguridad de Chrome introducido en v111 que no tiene bypass para descargas HTTP en modo headless. Es una restricción del navegador, no de Playwright.

**Solución aplicada:**
```typescript
test.info().annotations.push({ type: 'testrail', description: 'C53' }); // ANTES del skip
test.skip(!!process.env.CI, 'Descarga HTTP bloqueada por Chrome en CI — ejecutar en local');
```
- Pasan en local con `HEADLESS=false`.
- En CI aparecen como `skipped` en TestRail (status 2).
- **Importante:** la anotación TestRail debe ir ANTES de `test.skip()`, de lo contrario el reporter no la captura.

**Mitigación alternativa no implementada:** Montar un proxy HTTPS terminador en el runner self-hosted o configurar el entorno de test con TLS.

---

### BUG-04 — Reporter crea run único "TE_Industria" al lanzar ambas regiones juntas

**Descripción:**
Al ejecutar los dos spec files en un mismo proceso Playwright, el reporter detectaba ficheros de ambas regiones y creaba un único run "TE_Industria" con los 18 casos combinados en lugar de 2 runs separados.

**Impacto:** Los resultados de Andalucía y Madrid se mezclaban en un único run de TestRail, perdiendo la trazabilidad por región.

**Causa raíz:** `detectRegion()` devolvía un único string y creaba un único run:
```typescript
if (hasMadrid && !hasAndalucia) return 'TE_Madrid';
if (hasAndalucia && !hasMadrid) return 'TE_Andalucia';
return 'TE_Industria'; // ← fallback al detectar ambas
```

**Solución aplicada:** Refactoring completo del reporter para soportar múltiples runs:
- `detectRegions()` devuelve `string[]` (un elemento por región detectada).
- `RegionRun` agrupa `runId + caseToTestId + pending` por región.
- `onTestEnd()` enruta cada resultado al run correcto usando la ruta del fichero de test.
- `onEnd()` cierra cada run de forma independiente.

---

### BUG-05 — `beforeAll` de warm-up causó regresión en resultados

**Descripción:**
Se intentó resolver BUG-01 mediante un `beforeAll` que hacía login y ejecutaba una búsqueda antes de los tests. La aproximación produjo una regresión grave: múltiples tests devolvían 0 resultados a pesar de que el servidor estaba caliente.

**Causa raíz (reconstruida):**
El `beforeAll` abre un browser context, navega al date picker, ejecuta una búsqueda y cierra el context. El estado del date picker queda en caché a nivel del proceso Playwright. Cuando los tests posteriores usan `setDateViaCalendar()` en sus propios contexts, el picker percibe que ya está en el mes correcto y completa en ~2s (sin verdadera navegación), pero la búsqueda devuelve 0 porque el estado de la página no está listo.

**Solución aplicada:** Revertir completamente el `beforeAll`. La estrategia de retry (BUG-01) es suficiente.

---

### BUG-06 — `test.describe.configure({ timeout })` no aplica a `beforeAll`

**Descripción:**
Al añadir el `beforeAll` de warm-up, se asumía que heredaría el timeout del describe (60s/90s). En realidad, los hooks `beforeAll`/`afterAll` usan el **timeout global** (30s en local), no el del describe.

**Causa raíz:** Comportamiento de Playwright: `test.describe.configure({ timeout })` aplica solo a los tests dentro del describe, no a los hooks.

**Solución aplicada (mientras existió el beforeAll):**
```typescript
test.beforeAll(async () => {
  test.setTimeout(120_000); // override explícito dentro del hook
  // ...
});
```

---

### BUG-07 — Date picker de Firefox con `display:none` en headless

**Descripción:**
Los botones de navegación del Vuetify date picker (Previous/Next month) tienen `display:none` en Firefox en modo headless. `force:true` no funciona porque el elemento no tiene dimensiones de layout. `dispatchEvent('click')` se intentó pero tampoco funcionó de forma fiable.

**Impacto:** No se pudo ejecutar la suite en Firefox headless.

**Causa raíz:** Comportamiento específico de Vuetify + Firefox headless donde los botones del picker se ocultan con `display:none` hasta que hay interacción.

**Solución aplicada:** El proyecto usa exclusivamente Chrome. Firefox queda fuera de la cobertura de browsers.

---

### BUG-08 — MadridPage usa `(this as any)` para override de locators readonly

**Descripción:**
`MadridPage` necesita sobreescribir los locators de fecha heredados de `AndaluciaPage` (porque Madrid no tiene IDs estáticos). Los locators son `readonly` en TypeScript, por lo que el override se hace con un cast forzado:
```typescript
(this as any).dateDesde = fechaDesde.locator('input').first();
```

**Impacto:** Pérdida de type-safety. Un cambio en los nombres de las propiedades en `AndaluciaPage` no daría error en tiempo de compilación para `MadridPage`.

**Estado:** Funciona en runtime pero es técnicamente una deuda.

---

## 11. Posibles mejoras

### 11.1 Arquitectura y código

**[ALTA] Refactorizar herencia MadridPage / AndaluciaPage**
`MadridPage extends AndaluciaPage` es funcional pero conceptualmente incorrecto: Madrid no es un tipo especializado de Andalucía. El acoplamiento obliga a usar `(this as any)` para el override de date pickers.

*Alternativa recomendada:* Extraer una clase intermedia `IndustriaBasePage extends BasePage` con los locators como `protected` (no `readonly`), y hacer que tanto `AndaluciaPage` como `MadridPage` extiendan `IndustriaBasePage` con sus propias implementaciones.

---

**[ALTA] Solución permanente para descargas en CI**

Las tres opciones ordenadas por viabilidad:

1. **TLS en el entorno de test** — configurar certificado HTTPS en `industriatest.ocaicp.com`. Chrome no bloquea descargas HTTPS. Es la solución correcta a largo plazo.
2. **Runner con display virtual** — usar `xvfb` + `headless: false` en el runner self-hosted Linux para evitar las restricciones de headless. No aplica en el runner actual (Windows sin display).
3. **Test de integración de API** — en lugar de descargar via UI, llamar directamente al endpoint que genera el XML/DBF y validar el contenido. Evita el problema del browser completamente.

---

**[MEDIA] Aumentar timeout de describe para Andalucía en local**

El timeout del describe de Andalucía en local es 60s. Con cold-start (35s polling) + overhead de setup, un test puede acercarse al límite. Subir a 90s en local para alinearlo con Madrid.

```typescript
test.describe.configure({ timeout: process.env.CI ? 120_000 : 90_000 });
```

---

**[MEDIA] Eliminar `(this as any)` en MadridPage**

Cambiar los locators de AndaluciaPage a `protected` (en lugar de `readonly`) para que las subclases puedan sobreescribirlos sin romper el sistema de tipos:

```typescript
// AndaluciaPage
protected dateDesde: Locator;
protected dateDesdeSlot: Locator;
// ...

// MadridPage — sin cast
this.dateDesde = fechaDesde.locator('input').first();
```

---

**[MEDIA] Añadir `.env.example` con todas las variables requeridas**

No existe un fichero de referencia para onboarding. Un desarrollador nuevo no sabe qué variables de entorno necesita configurar.

```bash
BASE_URL=http://industriatest.ocaicp.com
TEST_USERNAME=
TEST_PASSWORD=
MADRID_USERNAME=
MADRID_PASSWORD=
TESTRAIL_URL=
TESTRAIL_USER=
TESTRAIL_API_KEY=
TESTRAIL_PROJECT_ID=3
TESTRAIL_ENABLED=false
```

---

**[MEDIA] Separar `andalucia.spec.ts` y `madrid.spec.ts` del npm run test**

Los specs de UI estructural (`andalucia.spec.ts`, `madrid.spec.ts`, `login.spec.ts`) no están incluidos en `test:andalucia` ni `test:madrid`, y tampoco tienen casos TestRail asignados. Se ejecutan solo con `npm test` (todos los specs). Esto crea inconsistencia: en CI nunca se ejecutan los tests de UI estructural.

*Solución:* Añadirlos al CI como un job separado `test-ui` o integrarlos en los jobs existentes, y asignarles casos TestRail.

---

**[BAJA] Reemplazar `page.waitForTimeout()` por waits explícitos**

En varios lugares del código se usan waits fijos que son frágiles:
- `login.spec.ts` línea 45: `page.waitForTimeout(1000)` — debería esperar al `.v-alert` visible.
- `andalucia.spec.ts`: `page.waitForTimeout(400)` en tests de desplegables — debería usar `waitFor({ state: 'visible' })` en las opciones del menú.

---

**[BAJA] Añadir validación de entorno al arrancar**

Si `TEST_USERNAME` está vacío, el test de login falla con un mensaje poco claro. Añadir validación al inicio:

```typescript
// global-setup.ts (ya existe pero está comentado)
if (!process.env.TEST_USERNAME) throw new Error('TEST_USERNAME no configurado');
```

---

**[BAJA] Cache de navegadores en el runner self-hosted**

El job CI instala Chromium en cada ejecución con `npx playwright install --with-deps chromium`. En un runner self-hosted esto es redundante si la versión de Playwright no cambia.

*Solución:* Añadir cache de `~/.cache/ms-playwright` condicionado al hash de `package-lock.json`:
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ hashFiles('package-lock.json') }}
```

---

### 11.2 Cobertura funcional

**[ALTA] Tests de paginación**
No existe ningún test que valide la paginación de la tabla:
- Navegar de página 1 a página 2.
- Cambiar el tamaño de página (10/25/50 registros).
- Verificar que el count del footer es consistente entre páginas.

---

**[ALTA] Tests de combinación de filtros**
Los tests actuales validan cada filtro de forma aislada. Casos sin cobertura:
- Sin Defectos + Pedido (combinado).
- Grave + Artículo (combinado).
- Múltiples filtros de resultado activos simultáneamente.

---

**[MEDIA] Validación de rango de fechas**
No existe test que verifique el comportamiento cuando `desde > hasta` o cuando se deja una fecha vacía.

---

**[MEDIA] Tests de búsqueda por Delegación, Inspector, Tipo de tramitación**
Los tests de `andalucia.spec.ts` verifican que estos campos son visibles y tienen opciones, pero ningún test de búsqueda los usa como filtro activo.

---

**[MEDIA] Test negativo de XML/DBF con selección vacía en Madrid**
`andalucia.spec.ts` tiene un test para "GENERAR XML sin selección → alerta". Madrid no tiene el equivalente para "GENERAR DBF sin selección".

---

**[BAJA] Test de descarga XML en local como smoke test separado**
C53/C54 se saltan en CI pero se ejecutan en local. Sería útil tenerlos marcados en TestRail de forma diferenciada (p.ej., como "Requiere entorno HTTP local") en lugar de simplemente "skipped".

---

**[BAJA] Test del botón SALIR desde Andalucía y Madrid**
Existe el test, pero solo valida la URL. Podría ampliarse para verificar que la sesión queda invalidada (intentar acceder a `/andalucia` después de salir redirige a login).

---

### 11.3 Operacional

**[ALTA] Notificaciones de resultado de CI**
No hay ningún mecanismo de notificación cuando el pipeline falla. Añadir un paso de notificación (email, Slack, Teams) en el job de CI para que el equipo sepa inmediatamente cuando hay fallos.

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
```

---

**[MEDIA] Limpiar scripts no utilizados / experimentos**

Los siguientes ficheros están en el repo pero no forman parte de la suite activa:
- `scripts/xray-import.ts` — integración Xray alternativa, no activa.
- `scripts/allure-setup.js` — Allure comentado en config.
- `tests/utils/explore.ts` y `tests/utils/explore-datepicker.spec.ts` — scripts de debug.
- `tests/global-setup.ts` — comentado, no en uso.

Se recomienda moverlos a una carpeta `_lab/` o eliminarlos para reducir ruido en el repositorio.

---

**[MEDIA] Documentar el proceso de actualización de TestData**

Cuando los datos del entorno cambian (nuevas inspecciones añadidas al rango de fechas de prueba), los valores hardcodeados en `TestData.busquedas.totales` y `TestData.madrid.totales` quedan desactualizados y todos los tests de count fallan. No hay ningún proceso documentado para detectar y actualizar estos valores.

*Sugerencia:* Añadir un script `scripts/validate-testdata.js` que haga las búsquedas vía API del backend y compare los resultados con los valores en `test-data.ts`, generando una alerta si difieren.

---

**[BAJA] Retención de artefactos CI**

Los reports se guardan 7 días. Para proyectos con ejecuciones diarias esto puede ser insuficiente para análisis de tendencias. Valorar subir a 30 días o exportar a un sistema de almacenamiento persistente.

---

## 12. Resumen ejecutivo

| Área | Estado actual | Riesgo |
|---|---|---|
| Cobertura Andalucía (C46-C52) | ✅ 7/7 activos y estables | Bajo |
| Cobertura Madrid (C250-C257) | ✅ 8/8 activos y estables | Bajo |
| Descargas (C53, C54, C258) | ⛔ Skip en CI, pasan en local | Medio — no hay cobertura automática en CI |
| Cold-start backend | ⚠️ Mitigado con retry + polling 45s | Medio — posible fallo si >45s |
| Batch loading (count parcial) | ✅ Resuelto con estabilización | Bajo |
| Reporter TestRail | ✅ Multi-región, sufijo CI/LOC | Bajo |
| Pipeline CI | ✅ 2 jobs paralelos, self-hosted | Bajo |
| Type safety MadridPage | ⚠️ `(this as any)` en locators | Bajo (funcional, deuda técnica) |
| Cobertura UI estructural | ⚠️ No incluida en CI | Medio |
| Documentación onboarding | ❌ Sin `.env.example` | Bajo-Medio |
