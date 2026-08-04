# Guía completa del proyecto — QA Automation Industria

---

## Índice

1. [Qué es este proyecto](#1-qué-es-este-proyecto)
2. [Puesta en marcha (de cero a corriendo tests)](#2-puesta-en-marcha-de-cero-a-corriendo-tests)
3. [Estructura de carpetas](#3-estructura-de-carpetas)
4. [Cómo está armado el código](#4-cómo-está-armado-el-código)
5. [Qué prueba cada archivo de test](#5-qué-prueba-cada-archivo-de-test)
6. [El repo: Bitbucket](#6-el-repo-bitbucket)
7. [Cómo se ejecutan los tests — 3 formas distintas](#7-cómo-se-ejecutan-los-tests--3-formas-distintas)
8. [Integración con TestRail](#8-integración-con-testrail)
9. [Problemas conocidos y por qué pasan](#9-problemas-conocidos-y-por-qué-pasan)
10. [Comandos más usados (chuleta rápida)](#10-comandos-más-usados-chuleta-rápida)
11. [Cosas pendientes / mejoras sugeridas](#11-cosas-pendientes--mejoras-sugeridas)

---

## 1. Qué es este proyecto

Es una suite de **tests automatizados end-to-end** (E2E) para la aplicación web "Industria" de OCA, que gestiona inspecciones. La app tiene dos módulos/regiones independientes con su propia URL y su propio usuario de acceso:

- **Andalucía** (`/andalucia`)
- **Madrid** (`/madrid`)

Los tests abren un navegador Chrome de verdad (vía Playwright), inician sesión, navegan por la app, aplican filtros de búsqueda, y comprueban que los resultados (conteos de registros, contenido de desplegables, ficheros descargados) sean los esperados. Todo simula lo que haría una persona probando la app a mano, pero automatizado.

**Stack:**
- [Playwright](https://playwright.dev/) — framework de automatización de navegador
- TypeScript
- Chromium (único navegador soportado — ver [BUG-07](#bug-07--date-picker-en-firefox-headless-no-funciona))
- [TestRail](https://www.testrail.io/) — donde queda registrado el resultado de cada ejecución (pasó/falló, con capturas)

**Entorno contra el que corren los tests:** `http://industriatest.ocaicp.com/` — es un entorno de **test**, no de producción, accesible solo desde la red corporativa (intranet) o VPN.

---

## 2. Puesta en marcha (de cero a corriendo tests)

### Requisitos
- Node.js 18 o superior (¡importante! ver la nota de Jenkins más abajo sobre por qué esto no es opcional)
- npm 9+
- Estar conectado a la red corporativa o VPN (la app es intranet)

### Instalación

```bash
git clone <url-del-repo>
cd industria
npm install
npx playwright install chromium
```

### Configurar variables de entorno

Copiar el archivo de ejemplo y completar los valores reales:

```bash
cp .env.example .env
```

Variables que hay que rellenar en `.env` (nunca se suben al repo, está en `.gitignore`):

| Variable | Para qué | Puede estar vacía |
|---|---|---|
| `BASE_URL` | URL del entorno de test (`http://industriatest.ocaicp.com/`) | No |
| `TEST_USERNAME` | Usuario de Andalucía | No |
| `TEST_PASSWORD` | Password de Andalucía | **Sí** — el entorno de test no siempre lo pide |
| `MADRID_USERNAME` | Usuario de Madrid | No |
| `MADRID_PASSWORD` | Password de Madrid | **Sí**, mismo caso |
| `HEADLESS` | `true`/`false` — si el navegador se ve o no al correr en local | — |
| `TESTRAIL_URL` | URL de la instancia de TestRail | Solo si `TESTRAIL_ENABLED=false` |
| `TESTRAIL_USER` | Usuario de TestRail (API) | Solo si `TESTRAIL_ENABLED=false` |
| `TESTRAIL_API_KEY` | API Key de TestRail (se genera en *Mi perfil → API Keys*) | Solo si `TESTRAIL_ENABLED=false` |
| `TESTRAIL_PROJECT_ID` | ID del proyecto en TestRail | Puede dejarse vacío, tiene default en código |
| `TESTRAIL_SUITE_ID` | ID de la suite en TestRail | Puede dejarse vacío, tiene default en código |
| `TESTRAIL_ENABLED` | `true` para que los resultados se suban a TestRail, `false` para no molestar a nadie mientras probás en local | — |

> Los IDs de TestRail (proyecto, suite, planes) están **hardcodeados** en el código además de leerse de `.env` — ver la sección de [TestRail](#8-integración-con-testrail) para entender por qué.

### Correr los tests

```bash
npm run test:andalucia   # solo Andalucía
npm run test:madrid      # solo Madrid
npm test                 # todo (incluye specs de estructura de UI, más lento)
```

> **Si PowerShell bloquea los scripts de npm** (`no se puede cargar el archivo... porque la ejecución de scripts está deshabilitada`), usar `cmd /c "npm run test:andalucia"` o correr una vez:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

### Ver el reporte de una corrida

```bash
npm run report
```

Esto abre `reports/html/index.html` en el navegador, vía un mini servidor local. **Importante:** nunca abrir ese `index.html` haciendo doble-click desde el explorador de archivos — el reporte usa JavaScript moderno (`<script type="module">`) que los navegadores bloquean por CORS cuando se abre como archivo local (`file://`). Por eso existe el comando `npm run report`, que lo sirve por HTTP y ahí sí funciona.

---

## 3. Estructura de carpetas

```
industria/
├── .github/workflows/
│   └── playwright.yml              # legacy, sin uso — el repo de trabajo es solo Bitbucket
├── bitbucket-pipelines.yml         # CI vía Bitbucket Pipelines (self-hosted runner)
├── Jenkinsfile                     # CI vía Jenkins (agente dentro de la red corporativa)
├── reporters/
│   └── testrail.reporter.ts        # Reporter custom: crea runs en TestRail y sube resultados
├── scripts/
│   ├── testrail-sync-andalucia.js  # Crea/sincroniza los casos de Andalucía en TestRail
│   ├── testrail-sync-madrid.js     # Ídem para Madrid
│   ├── testrail-mapping-andalucia.json  # Mapeo título ↔ caseId (se regenera con el script de sync)
│   ├── testrail-mapping-madrid.json
│   ├── testrail-verify.js          # Verifica conectividad con TestRail
│   ├── testrail-list-suites.js     # Lista suites de un proyecto TestRail
│   ├── generate-summary.js / generate-summary-v2.js  # Genera un resumen HTML de resultados
│   ├── allure-setup.js             # Setup de Allure (reporter comentado, no activo)
│   └── xray-import.ts              # Import alternativo a Jira Xray (no activo, ver package.json script `test:xray`)
├── tests/
│   ├── fixtures/
│   │   └── base.fixture.ts         # Fixtures de Playwright: loginPage, authenticatedPage, authenticatedMadridPage
│   ├── helpers/
│   │   └── test-data.ts            # Datos de prueba centralizados (credenciales, fechas, totales esperados)
│   ├── pages/                      # Page Object Model
│   │   ├── BasePage.ts             # Clase base: navigate(), waitForPageLoad(), takeScreenshot()
│   │   ├── LoginPage.ts            # POM del login
│   │   ├── AndaluciaPage.ts        # POM de Andalucía (el más grande y complejo)
│   │   └── MadridPage.ts           # POM de Madrid — extiende AndaluciaPage
│   ├── specs/
│   │   ├── login.spec.ts                          # Tests de login (7 casos)
│   │   └── industria/
│   │       ├── andalucia/
│   │       │   ├── andalucia.spec.ts               # Tests de estructura/UI (27 casos) — NO corren en CI
│   │       │   └── andalucia-busqueda.spec.ts       # Tests funcionales de búsqueda (12 casos, con TestRail)
│   │       └── madrid/
│   │           ├── madrid.spec.ts                  # Tests de estructura/UI (17 casos) — NO corren en CI
│   │           └── madrid-busqueda.spec.ts          # Tests funcionales de búsqueda (10 casos, con TestRail)
│   ├── utils/
│   │   ├── explore.ts                   # Script de exploración manual, no es un test
│   │   └── explore-datepicker.spec.ts   # Spec de diagnóstico del date picker, mantener por si hace falta debuguear
│   └── global-setup.ts             # ⚠️ Comentado en playwright.config.ts, no está en uso (ver más abajo por qué)
├── docs/
│   └── analisis-proyecto.md        # Este documento
├── playwright.config.ts            # Configuración central de Playwright
├── tsconfig.json
├── package.json
├── .env / .env.example
└── .gitignore
```

---

## 4. Cómo está armado el código

### 4.1 Configuración de Playwright (`playwright.config.ts`)

Puntos que no son obvios a simple vista:

- **`workers: 1`** — aunque `fullyParallel: true` está activado, `workers: 1` fuerza a que los tests corran **de a uno**, nunca en paralelo. Es intencional: el backend de la app no tolera bien peticiones concurrentes con distintas sesiones.
- **`retries: 1`** — cada test que falla se reintenta una vez automáticamente, tanto en local como en CI. Esto no es solo por flakiness genérica: mitiga un problema real de "cold-start" del backend (ver [BUG-01](#bug-01--cold-start-del-backend)).
- **`baseURL: process.env.BASE_URL || 'http://industria.ocaicp.com'`** — ojo que el fallback **no** tiene "test" en el nombre. Si `BASE_URL` no está bien seteado (por ejemplo, falta como secret en CI), los tests apuntan a un entorno distinto al esperado y fallan de forma confusa (ver sección de troubleshooting).
- **`globalSetup` está comentado** (línea muerta a propósito, con el comentario explicando por qué): la app usa sesión de servidor, y el mecanismo de `storageState` de Playwright (guardar cookies/localStorage para reusar sesión entre tests) no funciona con esta app — el archivo guarda 0 cookies y 0 localStorage. Por eso cada test hace login desde cero vía las fixtures (`authenticatedPage` / `authenticatedMadridPage`), en vez de reusar una sesión guardada.
- **Reporters activos:** `html`, `junit`, `list` (consola) y el reporter custom de TestRail. `allure-playwright` está comentado, no activo.
- **`screenshot: 'only-on-failure'`** — solo se capturan pantallazos cuando un test falla, para no saturar TestRail con adjuntos innecesarios (ver la memoria del bug `$test_count` de TestRail más abajo).

### 4.2 Page Object Model

Jerarquía de clases:

```
BasePage (abstracta)
  └── LoginPage
  └── AndaluciaPage
        └── MadridPage
```

- **`BasePage`** — mínima, solo provee `navigate()`, `waitForPageLoad()`, `takeScreenshot()`.
- **`LoginPage`** — localiza por IDs fijos (`#user`, `#password`). El método `login()` navega, rellena usuario (y password si no está vacío), clickea LOGIN y espera a que la red esté quieta.
- **`AndaluciaPage`** — la clase más grande del proyecto. Tiene los locators de todos los filtros y botones, y varios métodos con lógica no trivial:
  - **`buscar()`** — clickea BUSCAR y, en paralelo, escucha la respuesta HTTP real del endpoint de búsqueda para capturar el conteo de resultados directo de la red (más confiable que leer el footer de la tabla, que puede mostrar un conteo parcial mientras cargan los datos por lotes).
  - **`setDateViaCalendar()`** — el método más complicado del proyecto. Abre el date picker de Vuetify, lee el mes/año mostrado en el header (en español, ej: "enero de 2026"), y navega mes a mes con los botones de flecha hasta llegar al día correcto (hasta 24 intentos).
  - **`getTotalResultCount()`** — primero intenta usar el conteo capturado de la red en `buscar()`; si no hay uno disponible, cae a un polling del footer de paginación (`.v-data-footer__pagination`), exigiendo 2 lecturas consecutivas idénticas antes de confiar en el número (para evitar leer un lote parcial).
- **`MadridPage`** — hereda de `AndaluciaPage`. Como los date pickers de Madrid no tienen IDs fijos (a diferencia de Andalucía), sus locators se reconstruyen en el constructor buscando por el texto del label. Agrega `btnPeriodicas`, `btnCorreccionDefectos`, `btnGenerarDbf`.

### 4.3 Fixtures (`base.fixture.ts`)

| Fixture | Qué hace |
|---|---|
| `loginPage` | Da un `LoginPage` sin loguear |
| `andaluciaPage` | Da un `AndaluciaPage` sin loguear |
| `authenticatedPage` | Loguea con las credenciales de Andalucía y da un `AndaluciaPage` ya listo |
| `authenticatedMadridPage` | Loguea con las credenciales de Madrid y da un `MadridPage` ya listo |

Todas son **por test** (no compartidas): cada test arranca con un browser context nuevo y limpio. Esto importa para los retries — cuando un test se reintenta, arranca de cero, no arrastra estado del intento anterior.

### 4.4 Test Data (`test-data.ts`)

Centraliza los datos de prueba: credenciales (leídas de `.env`, nunca hardcodeadas), fechas de búsqueda (`2026-01-08` a `2026-01-09`), y **los totales esperados de cada filtro** (ej: "Sin Defectos debería devolver 100 registros").

**Punto importante:** esos totales son números fijos que se corresponden con los datos que había en el entorno de test en el momento en que se escribieron los tests. Como es un entorno de test (no productivo), los datos cambian con el tiempo (se agregan o borran inspecciones), así que estos números **se desactualizan solos** y hay que revisarlos de vez en cuando — no es un bug del código cuando un test de conteo falla, hay que verificar primero si el dato de referencia sigue siendo correcto.

---

## 5. Qué prueba cada archivo de test

### `login.spec.ts` — 7 casos
Formulario visible, título de página, login válido redirige a `/andalucia`, el campo usuario acepta texto, login sin usuario se queda en la pantalla de login, botón habilitado, etc. Tests de UI básica del login.

### `andalucia.spec.ts` / `madrid.spec.ts` — 27 / 17 casos
Tests de **estructura y UI**: que los filtros estén visibles, que los botones cambien de estado al clickear, que la tabla tenga las columnas correctas, que el mensaje de "sin datos" aparezca, etc. **No hacen búsquedas reales con conteos** y **no están conectados a TestRail** (no tienen anotaciones `testrail`) ni se ejecutan en ningún CI — solo corren con `npm test` (todos los specs juntos).

### `andalucia-busqueda.spec.ts` — 12 casos (TestRail C46-C57)
Los tests "de verdad" — cada uno hace una búsqueda real contra el backend y compara el resultado contra un valor esperado:

| Test | Qué verifica |
|---|---|
| Búsqueda por fechas | Conteo exacto de registros |
| Filtro Sin Defectos / Leve a Reparar / Grave / Crítico | Conteo exacto por cada filtro |
| Búsqueda por número de pedido | Al menos 1 resultado, y que el pedido aparezca en la tabla |
| Búsqueda por artículo | Conteo exacto |
| Generar XML (descarga) | Nombre del archivo correcto — **se salta en CI**, ver [BUG-03](#bug-03--descargas-bloqueadas-en-ci) |
| XML generado — estructura y contenido | Valida 15 etiquetas obligatorias + reglas de contenido — también se salta en CI |
| Desplegables Inspector / Delegación / Provincia | Que tengan datos cargados, ninguno vacío |

### `madrid-busqueda.spec.ts` — 10 casos (TestRail C58-C67)
Mismo espíritu que Andalucía, adaptado a Madrid: filtros de tipo de actuación (Periódicas / Corrección de Defectos), conteos por filtro de resultado, búsqueda por pedido/artículo, descarga de ZIP con certificados (DBF, se salta en CI), y desplegable de Inspector (Madrid **no tiene** tests de Delegación/Provincia — no está confirmado si esos campos existen en su UI, solo que nadie los testeó).

---

## 6. El repo: Bitbucket

El único repo que importa para este proyecto es:

**`bitbucket`** → `https://bitbucket.org/oca-global/oca-industria-automation-tests.git`

Ahí vive el equipo, ahí corre el CI de verdad (Bitbucket Pipelines), y es el que hay que usar siempre. Rama principal: `main` (no `master`).

> Nota histórica: en algún momento el repo también se mantuvo espejado en un GitHub personal del autor original, con un método de sincronización manual (cherry-pick) para no reescribir historiales. Eso ya **no hace falta** — no es parte del flujo de trabajo del equipo, solo Bitbucket importa.

---

## 7. Cómo se ejecutan los tests — 3 formas distintas

### 7.1 En local
`npm run test:andalucia` / `npm run test:madrid` / `npm test`, como se explicó en la sección 2.

### 7.2 Bitbucket Pipelines (`bitbucket-pipelines.yml`)
- Pipelines **custom** (no se disparan solos con cada push, hay que lanzarlos manualmente desde la pestaña Pipelines de Bitbucket, eligiendo `andalucia`, `madrid` o `all`).
- Requiere un runner self-hosted con acceso a la red corporativa/VPN, corriendo como un **servicio de Windows** (`bitbucket-runner\bin\run-loop.ps1`) — por eso queda siempre levantado sin que nadie tenga que arrancarlo a mano.
- Variables necesarias como *Repository variables* en Bitbucket (Settings → Pipelines → Repository variables): `BASE_URL`, `TEST_USERNAME`, `TEST_PASSWORD`, `MADRID_USERNAME`, `MADRID_PASSWORD`, `TESTRAIL_URL`, `TESTRAIL_USER`, `TESTRAIL_API_KEY`, `TESTRAIL_ENABLED`, `HEADLESS`.

### 7.3 Jenkins (`Jenkinsfile`) — agregado el 2026-08-03
Se agregó como alternativa a los dos anteriores porque **ambos runners self-hosted viven en la laptop personal de un desarrollador que se va de la empresa**, y ese runner depende de que esa persona tenga la VPN activa. Jenkins, en cambio, corre en un agente (`SVJenkinsWin`, Windows Server 2022) que ya está **dentro de la red corporativa** — no depende de la laptop de nadie ni de VPN.

**Cómo está configurado:**
- `agent { label 'windows' }` — label genérico (no el nombre puntual del nodo).
- `tools { nodejs 'node-lts' }` — **crítico**. El Node del sistema operativo en `SVJenkinsWin` es v14 con npm 6, demasiado viejo para este proyecto (el `package-lock.json` usa `lockfileVersion: 3`, que pide npm 7+; y Playwright directamente requiere Node 18+). Sin este bloque, `npm ci` falla con un error muy poco claro: `Cannot read property '@playwright/test' of undefined` — no menciona la versión de Node para nada, así que si eso vuelve a pasar, lo primero a revisar es esto.
- Checkout del repo (Bitbucket) por **HTTPS con un Repository Access Token** (no SSH): en la cuenta de Bitbucket usada no había opción de generar App Passwords, y por SSH fallaba con "Host key verification failed" porque nadie con permisos de admin de Jenkins estaba disponible para agregar la host key de `bitbucket.org` al `known_hosts` del agente. El token se genera en **el repo → Repository settings → Access Tokens**, con scope únicamente `Repositories: Read`. En Jenkins la credencial es tipo *Username with password*: usuario `x-token-auth` (fijo), password = el token.
- Parámetro `REGION` (`all` / `andalucia` / `madrid`), mismo criterio que Bitbucket Pipelines.
- Credenciales necesarias en Jenkins (tipo **Secret text**, con estos IDs exactos porque así los referencia el Jenkinsfile): `industria-base-url`, `industria-test-username`, `industria-madrid-username`, `industria-testrail-url`, `industria-testrail-user`, `industria-testrail-api-key`. **No hace falta** crear credenciales de password (`TEST_PASSWORD`/`MADRID_PASSWORD`) — están vacías en `.env` y el login las soporta como opcionales.
- El stage `Install` (`npm cache clean --force`, `npm ci`, `npx playwright install --with-deps chromium`) corre siempre, en todos los builds, sin importar el `REGION` elegido.
- **Primer build:** ~3 minutos (todo desde cero). **Builds siguientes:** ~20 segundos, porque Jenkins no borra el workspace entre builds — `node_modules` y el navegador Chromium quedan cacheados en disco.
- **Ver el reporte HTML desde Jenkins no funciona bien directo en el navegador** — Jenkins aplica una Content-Security-Policy a los artifacts servidos que bloquea la ejecución de JS embebido, así que al abrir el `index.html` desde el visor de artifacts se ve el código fuente crudo en pantalla en vez del reporte. Y si se descarga y se abre como archivo local (doble-click), queda en blanco por el mismo motivo de CORS explicado en la sección 2. La forma de verlo bien: descargar la carpeta `reports/html` del build y correr `npm run report` localmente apuntando a esa carpeta. Solución permanente pendiente: plugin **HTML Publisher** de Jenkins (necesita admin).

---

## 8. Integración con TestRail

> ⚠️ **TestRail requiere un plan pago para uso continuo.** Sin una suscripción, la instancia usada es efectivamente temporal (trial/demo) — cada vez que se necesite volver a usar TestRail habrá que repetir el alta desde cero: registrar un usuario nuevo (con su email), crear una instancia nueva, y generar un API Token nuevo. Todo lo que está documentado en esta sección (URL, IDs de proyecto/suite/planes) **va a cambiar** la próxima vez que esto pase, y hay que repetir el [checklist de migración](#checklist-para-migrar-a-otra-instanciaproyecto-de-testrail-ya-se-hizo-una-vez) de abajo. Si el equipo quiere usar TestRail de forma estable y permanente, la única forma es pagar una licencia.

### Instancia actual (desde 2026-08-03)

Se migró a una instancia nueva para cerrar una demo:

- **URL:** `https://ocaglobalit.testrail.io`
- **Proyecto:** "Web", ID `2`
- **Suite:** "Master", ID `6`
- **Test Plan Andalucía:** ID `13`
- **Test Plan Madrid:** ID `15`

> Antes se usaba `oca.testrail.io` (proyecto "Web" ID `3`). Si en algún momento se ve un `.env` apuntando a esa URL vieja, hay que verificar si el cambio fue intencional o un error.

**Estos IDs están hardcodeados en `reporters/testrail.reporter.ts`** (decisión explícita: no crear variables de entorno nuevas para esto, todo en código, con fallback si `.env` no las trae):

```typescript
const PROJECT_ID = parseInt(process.env.TESTRAIL_PROJECT_ID || '2', 10);
const SUITE_ID   = parseIntOrUndefined(process.env.TESTRAIL_SUITE_ID) ?? 6;
const PLAN_ID_BY_REGION = {
  TE_Andalucia: 13,
  TE_Madrid:    15,
};
```

### Cómo funciona el reporter (ciclo de vida)

```
onBegin()
  → detecta qué regiones hay en los tests que van a correr (por ruta de archivo)
  → por cada región, si hay un Test Plan asociado:
      → add_plan_entry (crea un run DENTRO del plan)
    si no hay plan asociado:
      → add_run (crea un run suelto, comportamiento antiguo, sigue existiendo como fallback)

onTestEnd() (por cada test que termina)
  → busca la anotación type='testrail' → extrae el número de caso (ej: 'C58')
  → guarda el resultado en memoria (si el test se reintenta, el segundo resultado pisa al primero)

onEnd()
  → por cada región:
      → sube todos los resultados a TestRail (add_result)
      → sube capturas de pantalla de los que fallaron
      → si el run pertenece a un plan, NO lo cierra (TestRail no lo permite — da 403.
        "This test run belongs to a test plan and cannot be closed independently")
      → si es un run suelto (sin plan), sí lo cierra (close_run)
```

### Mapeo de casos (título ↔ número de TestRail)

Los archivos `scripts/testrail-mapping-andalucia.json` y `-madrid.json` mapean el título de cada test con su ID real en TestRail. Cada test en el código tiene una anotación con ese ID:

```typescript
test.info().annotations.push({ type: 'testrail', description: 'C58' });
```

**Si el número en esa anotación no coincide con el mapping, el resultado de ese test simplemente no llega a TestRail — sin ningún error visible.** Esto ya pasó dos veces en este proyecto: cuando se agregaron tests nuevos (los de desplegables) sin correr el script de sync, y de nuevo al migrar de instancia (los números de Madrid cambiaron de C250-C259 a C58-C67, aunque los de Andalucía coincidieron por casualidad).

**Números actuales:**
- Andalucía: C46 a C57
- Madrid: C58 a C67

### Checklist para migrar a otra instancia/proyecto de TestRail (ya se hizo una vez)

1. Crear el proyecto nuevo en la instancia (`add_project`, modo single-suite).
2. Actualizar la constante `PROJECT_ID` **dentro de** `scripts/testrail-sync-andalucia.js` y `scripts/testrail-sync-madrid.js` (es una variable local en cada script, no viene de `.env`).
3. Correr ambos scripts (`node scripts/testrail-sync-andalucia.js`, ídem madrid) — crean las secciones y los casos, y regeneran los JSON de mapping.
4. Actualizar las anotaciones `C##` en `andalucia-busqueda.spec.ts` y `madrid-busqueda.spec.ts` para que coincidan con los IDs nuevos que salieron del paso anterior (casi nunca son los mismos números que antes).
5. Crear los Test Plans "Andalucia" y "Madrid" con `add_plan`, incluyendo los `case_ids` del mapping en sus `entries`.
6. Actualizar `PROJECT_ID` / `SUITE_ID` / `PLAN_ID_BY_REGION` en `reporters/testrail.reporter.ts`.
7. Correr una vez en local con `TESTRAIL_ENABLED=true` y confirmar que los resultados aparecen en el plan correcto antes de dar el cambio por cerrado.

### Otras cosas a tener en cuenta

- `add_plan_entry` **exige** `suite_id` en el body (a diferencia de `add_run`, que no lo pide) — si falta, tira `400 Field :suite_id is a required field`.
- Hay un bug conocido, **ajeno a este reporter**, en la interfaz de TestRail: al abrir cualquier run aparece el mensaje `Undefined variable $test_count`. Se investigó a fondo y es un bug del propio SaaS (relacionado a un adjunto duplicado que devuelve la propia API de TestRail), no algo que este código esté causando. Se redujo el volumen de adjuntos (ya no se sube captura en los tests que pasan, solo en los que fallan) para no estresar esa parte del backend, pero el mensaje puede seguir apareciendo — no perder tiempo re-investigándolo si vuelve a aparecer.

---

## 9. Problemas conocidos y por qué pasan

### BUG-01 — Cold-start del backend

El backend (MuleSoft/Salesforce) tarda 30-45s en responder la primera petición después de estar inactivo. Los siguientes pedidos son rápidos. Esto hace que el primer test de cada suite (el de conteo por fechas) falle con `0` registros si el servidor estaba "frío".

**Mitigación:** `retries: 1` — el primer intento (aunque falle) calienta el servidor, así que el reintento ya responde rápido. No es 100% infalible si el cold-start tarda más de lo que dura el polling.

### BUG-02 — Conteo parcial por carga en lotes

El servidor devuelve los resultados en tandas. El footer de paginación de Vuetify se actualiza con el conteo parcial antes de que terminen de llegar todos los lotes, así que leer el número una sola vez puede dar un valor de menos (ej: 98 en vez de 100).

**Solución:** `getTotalResultCount()` exige 2 lecturas consecutivas idénticas antes de confiar en el número.

### BUG-03 — Descargas bloqueadas en CI

Chrome 111+ en modo headless bloquea las descargas por HTTP (sin TLS), y el entorno de test no tiene HTTPS. Los tests que descargan archivos (XML de Andalucía, ZIP de Madrid) se saltan automáticamente en CI (`test.skip(!!process.env.CI, ...)`) y solo se ejecutan en local con `HEADLESS=false`.

**Importante:** la anotación de TestRail tiene que ir **antes** del `test.skip()` en el código, si no el reporter no la captura y el test ni figura como "skipped" en TestRail.

### BUG-07 — Date picker en Firefox headless no funciona

Los botones de navegación del date picker de Vuetify quedan con `display:none` en Firefox headless, y ni `force:true` ni `dispatchEvent` lo solucionan de forma confiable. Por eso el proyecto usa **exclusivamente Chromium**.

### BUG-08 — `MadridPage` usa `(this as any)` para pisar locators

`MadridPage` necesita sobreescribir los locators de fecha heredados de `AndaluciaPage` (que son `readonly` en TypeScript), así que lo hace con un cast forzado que rompe la seguridad de tipos. Funciona en runtime, es deuda técnica — ver sugerencia de refactor en la sección 11.

### Problemas del setup de hoy (2026-08-03), por si se repiten

- **`npm ci` falla con `Cannot read property '@playwright/test' of undefined`** → casi siempre es una versión de npm demasiado vieja (<7) leyendo un `package-lock.json` con `lockfileVersion: 3`. Revisar `node -v && npm -v` en el agente/máquina donde corre.
- **Reporte HTML de Playwright se ve como código fuente crudo, o queda en blanco** → ver sección 7.3, es un tema de CSP de Jenkins (código crudo) o de CORS al abrir un archivo local (blanco). Usar siempre `npm run report`.
- **Tests fallan TODOS en el mismo punto (login)** → revisar primero si hay VPN/red corporativa activa (la app es intranet) antes de sospechar del código.
- **Tests fallan en el mismo punto pero DESPUÉS del login (ej: no encuentra ningún botón del dashboard)** → sospechar de credenciales mal cargadas en el CI (usuario/URL equivocados), no del entorno — comparar corriendo la misma suite en local con el mismo `.env` para descartar que sea un problema real de la app.

---

## 10. Comandos más usados (chuleta rápida)

```bash
# Instalación inicial
npm install
npx playwright install chromium

# Correr tests
npm run test:andalucia
npm run test:madrid
npm test                        # todo, incluye specs de estructura de UI
npm run test:headed             # con navegador visible
npm run test:debug              # paso a paso

# Ver reportes
npm run report                  # reporte HTML interactivo (¡nunca abrir el .html directo!)
npm run report:summary          # genera y abre un summary.html a partir del JUnit XML

# TestRail
node scripts/testrail-sync-andalucia.js   # crea/sincroniza casos de Andalucía
node scripts/testrail-sync-madrid.js      # ídem Madrid
node scripts/testrail-list-suites.js 2    # lista suites del proyecto (2 = proyecto "Web" actual)
node scripts/testrail-verify.js           # verifica que las credenciales de TestRail conectan
```

---

## 11. Cosas pendientes / mejoras sugeridas

Ordenadas por impacto, no por orden de cuándo se detectaron:

- **Refactor de `MadridPage extends AndaluciaPage`** — conceptualmente Madrid no es un "tipo de" Andalucía. Cambiar los locators de `AndaluciaPage` de `readonly` a `protected` para que `MadridPage` los pueda sobreescribir sin el cast `(this as any)`.
- **Solución permanente para las descargas bloqueadas en CI** — la opción más limpia a largo plazo es poner TLS/HTTPS en el entorno de test; mientras tanto, se podría probar/validar el archivo generado llamando directo al endpoint de la API en vez de descargarlo vía UI.
- **Los specs de estructura de UI (`andalucia.spec.ts`, `madrid.spec.ts`, `login.spec.ts`) no corren en ningún CI** — solo con `npm test` local. Si se quiere que su cobertura cuente para algo formal, habría que agregarlos a algún job de CI y darles anotaciones de TestRail (hoy no tienen).
- **Proceso para mantener actualizados los totales esperados en `test-data.ts`** — hoy no hay ningún aviso automático cuando el entorno de test cambia sus datos y los conteos hardcodeados quedan desactualizados. Se podría armar un script que compare contra la API del backend y avise si difieren.
- **Instalar el plugin HTML Publisher en Jenkins** (requiere admin) para poder ver el reporte de Playwright directo en el navegador sin tener que descargarlo.
- **Eliminar `.github/workflows/playwright.yml`** si definitivamente no se va a volver a usar GitHub — hoy queda como archivo muerto en el repo.
- **Revisar si conviene mantener los dos caminos de CI** (Bitbucket Pipelines y Jenkins) a largo plazo, o consolidar en uno solo una vez que quede claro cuál es el más estable/accesible para el equipo que se queda con el proyecto.
