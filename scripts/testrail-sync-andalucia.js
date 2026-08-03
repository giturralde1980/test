/**
 * Sincroniza los casos de andalucia-busqueda.spec.ts en TestRail.
 * Proyecto "Web" (ID 3) — modo single-suite (sin suites explícitas).
 * Busca o crea la sección "Andalucia". Solo crea los casos que no existan.
 * Cada caso incluye steps en español con expected results.
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const TR_URL     = process.env.TESTRAIL_URL;
const TR_USER    = process.env.TESTRAIL_USER;
const TR_KEY     = process.env.TESTRAIL_API_KEY;
const PROJECT_ID = 2; // Web

const AUTH = Buffer.from(`${TR_USER}:${TR_KEY}`).toString('base64');

async function tr(method, endpoint, body) {
  const res = await fetch(`${TR_URL}/index.php?/api/v2/${endpoint}`, {
    method,
    headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`[${res.status}] ${endpoint}: ${JSON.stringify(data)}`);
  return data;
}

// ── Definición de casos con steps ────────────────────────────────────────────

const LOGIN_STEP = {
  content:  'Acceder al sistema con el usuario adminand',
  expected: 'Se muestra correctamente el dashboard de inspecciones de Andalucía (INDUSTRIA ANDALUCIA)',
};
const FECHA_DESDE_STEP = {
  content:  'Establecer el campo Fecha Desde → 08/01/2026',
  expected: 'El campo date picker muestra la fecha 08/01/2026',
};
const FECHA_HASTA_STEP = {
  content:  'Establecer el campo Fecha Hasta → 09/01/2026',
  expected: 'El campo date picker muestra la fecha 09/01/2026',
};
const BUSCAR_STEP = (expected) => ({
  content:  'Hacer clic en el botón BUSCAR',
  expected,
});

const CASES = [
  {
    title: 'Verificar que la búsqueda por fechas 08-09 ene 2026 devuelve 165 registros',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      BUSCAR_STEP('La tabla de resultados muestra exactamente 165 registros en el rango de fechas indicado'),
    ],
  },
  {
    title: 'Verificar que el filtro Sin Defectos + fechas devuelve 100 registros',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Hacer clic en el botón de resultado SIN DEFECTOS', expected: 'El botón queda activo (resaltado)' },
      BUSCAR_STEP('La tabla muestra exactamente 100 registros con resultado Sin Defectos'),
    ],
  },
  {
    title: 'Verificar que el filtro Leve a Reparar + fechas devuelve 33 registros',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Hacer clic en el botón de resultado LEVE A REPARAR', expected: 'El botón queda activo (resaltado)' },
      BUSCAR_STEP('La tabla muestra exactamente 33 registros con resultado Leve a Reparar'),
    ],
  },
  {
    title: 'Verificar que el filtro Grave + fechas devuelve 32 registros',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Hacer clic en el botón de resultado GRAVE', expected: 'El botón queda activo (resaltado)' },
      BUSCAR_STEP('La tabla muestra exactamente 32 registros con resultado Grave'),
    ],
  },
  {
    title: 'Verificar que el filtro Crítico + fechas devuelve 0 registros y la tabla aparece vacía',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Hacer clic en el botón de resultado CRÍTICO', expected: 'El botón queda activo (resaltado)' },
      BUSCAR_STEP('La tabla muestra 0 registros y aparece el mensaje "No data available"'),
    ],
  },
  {
    title: 'Verificar que la búsqueda por número de pedido + fechas devuelve resultados que incluyen ese pedido',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Introducir el número de pedido en el campo Nº de pedido', expected: 'El campo muestra el valor introducido' },
      BUSCAR_STEP('La tabla muestra al menos 1 resultado y el número de pedido aparece visible en la primera página'),
    ],
  },
  {
    title: 'Verificar que la búsqueda por artículo + fechas devuelve 6 registros',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Seleccionar el artículo en el campo Artículos', expected: 'El artículo queda seleccionado en el desplegable' },
      BUSCAR_STEP('La tabla muestra exactamente 6 registros para el artículo seleccionado'),
    ],
  },
  {
    title: 'Verificar que al generar XML se descarga un fichero SIOCA_YYYYMMDD_HHMMSS.xml',
    steps: [
      LOGIN_STEP,
      { content: 'Establecer fechas 08/01/2026 - 09/01/2026 y hacer clic en BUSCAR', expected: 'La tabla muestra 165 registros' },
      { content: 'Seleccionar la primera inspección de la tabla marcando su checkbox', expected: 'La fila queda seleccionada' },
      { content: 'Hacer clic en el botón GENERAR XML', expected: 'Se descarga un fichero cuyo nombre cumple el patrón SIOCA_YYYYMMDD_HHMMSS.xml (ej: SIOCA_20260108_143022.xml)' },
    ],
  },
  {
    title: 'Verificar que el XML generado tiene estructura y contenido válidos',
    steps: [
      LOGIN_STEP,
      { content: 'Establecer fechas 08/01/2026 - 09/01/2026, hacer clic en BUSCAR y seleccionar la primera inspección', expected: 'La tabla muestra 165 registros y la fila queda seleccionada' },
      { content: 'Hacer clic en GENERAR XML y guardar el fichero descargado', expected: 'El fichero XML se descarga correctamente' },
      {
        content: 'Abrir y parsear el contenido del fichero XML',
        expected:
          'El XML contiene las etiquetas: <sioca>, <comunicaciones>, <comunicacion>, <tipo>, <inspeccion>, <instalacion>, <certificado>, <fecha>, <reglamento>, <duracion>, <inspector>, <titular>, <domicilio>, <tipo_documentacion>, <numero_documentacion>. ' +
          '<tipo> es ALTA o RESULTADO. ' +
          '<fecha> tiene formato DD/MM/YYYY y está dentro del rango 08/01/2026 - 09/01/2026. ' +
          '<duracion> es un número ≥ 0. ' +
          '<titular><nombre> y <numero_documentacion> no están vacíos. ' +
          '<tipo_documentacion> es uno de: CIF, NIF, NIE, PASAPORTE.',
      },
    ],
  },
  {
    title: 'Verificar que el desplegable Inspector está cargado con datos',
    steps: [
      LOGIN_STEP,
      { content: 'Hacer clic en el desplegable Inspector', expected: 'El desplegable se abre y muestra un listado de opciones' },
      {
        content: 'Comprobar el contenido del listado desplegado',
        expected: 'El listado contiene al menos una opción y ninguna aparece vacía (texto en blanco)',
      },
    ],
  },
  {
    title: 'Verificar que el desplegable Delegación está cargado con datos',
    steps: [
      LOGIN_STEP,
      { content: 'Hacer clic en el desplegable Delegación', expected: 'El desplegable se abre y muestra un listado de opciones' },
      {
        content: 'Comprobar el contenido del listado desplegado',
        expected: 'El listado contiene al menos una opción y ninguna aparece vacía (texto en blanco)',
      },
    ],
  },
  {
    title: 'Verificar que el desplegable Provincia está cargado con datos',
    steps: [
      LOGIN_STEP,
      { content: 'Hacer clic en el desplegable Provincia', expected: 'El desplegable se abre y muestra un listado de opciones' },
      {
        content: 'Comprobar el contenido del listado desplegado',
        expected: 'El listado contiene al menos una opción y ninguna aparece vacía (texto en blanco)',
      },
    ],
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // 1. Obtener suite_id (modo single-suite: devuelve exactamente 1)
  const suites = await tr('GET', `get_suites/${PROJECT_ID}`);
  const suiteId = suites.length ? suites[0].id : null;
  const suiteParam = suiteId ? `&suite_id=${suiteId}` : '';
  console.log(suiteId ? `Suite: [${suiteId}] ${suites[0].name}` : 'Modo single-suite (sin suites explícitas)');

  // 2. Buscar o crear sección "Andalucia"
  const sectionsData = await tr('GET', `get_sections/${PROJECT_ID}${suiteParam}`);
  const allSections  = sectionsData.sections ?? sectionsData;
  let section = allSections.find(s => s.name.toLowerCase() === 'andalucia');
  if (!section) {
    const body = { name: 'Andalucia' };
    if (suiteId) body.suite_id = suiteId;
    section = await tr('POST', `add_section/${PROJECT_ID}`, body);
    console.log(`Sección "Andalucia" creada: ID ${section.id}`);
  } else {
    console.log(`Sección "Andalucia" encontrada: ID ${section.id}`);
  }

  // 3. Casos existentes en la sección
  const casesData = await tr('GET', `get_cases/${PROJECT_ID}${suiteParam}&section_id=${section.id}`);
  const existing  = casesData.cases ?? casesData;
  const byTitle   = new Map(existing.map(c => [c.title.trim(), c.id]));
  console.log(`Casos existentes en la sección: ${existing.length}\n`);

  // 4. Crear o reutilizar casos
  const mapping = []; // { title, caseId }
  for (const { title, steps } of CASES) {
    if (byTitle.has(title)) {
      const id = byTitle.get(title);
      mapping.push({ title, caseId: id });
      console.log(`  skip  C${id}  "${title}"`);
    } else {
      const payload = { title, custom_steps_separated: steps };
      const created = await tr('POST', `add_case/${section.id}`, payload);
      mapping.push({ title, caseId: created.id });
      console.log(`  crear C${created.id}  "${title}"`);
    }
  }

  // 5. Actualizar .env con suite_id (si aplica)
  if (suiteId) {
    const envPath = path.join(process.cwd(), '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace(/^TESTRAIL_SUITE_ID=.*$/m, `TESTRAIL_SUITE_ID=${suiteId}`);
    fs.writeFileSync(envPath, env, 'utf8');
  }

  // 6. Guardar mapping JSON
  const mappingPath = path.join(process.cwd(), 'scripts', 'testrail-mapping-andalucia.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf8');

  console.log(`\nMapping guardado → scripts/testrail-mapping-andalucia.json`);
  console.log('\n── IDs de casos en TestRail ────────────────────────────');
  mapping.forEach(({ title, caseId }) => console.log(`  C${caseId}  ${title}`));
})();
