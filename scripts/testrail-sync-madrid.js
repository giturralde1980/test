/**
 * Sincroniza los casos de madrid-busqueda.spec.ts en TestRail.
 * Proyecto "Web" (ID 3) — sección "Madrid".
 * Solo crea los casos que no existan. Cada caso incluye steps en español.
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const TR_URL     = process.env.TESTRAIL_URL;
const TR_USER    = process.env.TESTRAIL_USER;
const TR_KEY     = process.env.TESTRAIL_API_KEY;
const PROJECT_ID = 2;

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

// ── Steps comunes ─────────────────────────────────────────────────────────────

const LOGIN_STEP = {
  content:  'Acceder al sistema con el usuario adminmad',
  expected: 'Se muestra correctamente el dashboard de inspecciones de Madrid (INDUSTRIA MADRID)',
};
const FECHA_DESDE_STEP = {
  content:  'Establecer el campo Fecha Desde → 08/01/2026',
  expected: 'El campo date picker muestra la fecha 08/01/2026',
};
const FECHA_HASTA_STEP = {
  content:  'Establecer el campo Fecha Hasta → 09/01/2026',
  expected: 'El campo date picker muestra la fecha 09/01/2026',
};
const BUSCAR = (expected) => ({ content: 'Hacer clic en el botón BUSCAR', expected });

// ── Definición de casos ───────────────────────────────────────────────────────

const CASES = [
  {
    title: 'Verificar que la búsqueda básica por fechas con Periódicas activo devuelve 37 registros',
    steps: [
      { content: 'Acceder al sistema con el usuario adminmad', expected: 'Dashboard de Madrid visible; el botón Periódicas aparece activo (resaltado) por defecto' },
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      BUSCAR('La tabla muestra exactamente 37 registros del tipo Periódicas'),
    ],
  },
  {
    title: 'Verificar que el filtro Corrección de Defectos + fechas devuelve 56 registros',
    steps: [
      LOGIN_STEP,
      { content: 'Hacer clic en el botón Corrección de Defectos', expected: 'El botón Corrección de Defectos queda activo; el botón Periódicas se desactiva' },
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      BUSCAR('La tabla muestra exactamente 56 registros del tipo Corrección de Defectos'),
    ],
  },
  {
    title: 'Verificar que el filtro Sin Defectos + fechas devuelve 17 registros',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Hacer clic en el botón de resultado SIN DEFECTOS', expected: 'El botón queda activo (resaltado)' },
      BUSCAR('La tabla muestra exactamente 17 registros con resultado Sin Defectos'),
    ],
  },
  {
    title: 'Verificar que el filtro Leve a Reparar + fechas devuelve 0 registros y la tabla aparece vacía',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Hacer clic en el botón de resultado LEVE A REPARAR', expected: 'El botón queda activo (resaltado)' },
      BUSCAR('La tabla muestra 0 registros y aparece el mensaje "No data available"'),
    ],
  },
  {
    title: 'Verificar que el filtro Grave + fechas devuelve 20 registros',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Hacer clic en el botón de resultado GRAVE', expected: 'El botón queda activo (resaltado)' },
      BUSCAR('La tabla muestra exactamente 20 registros con resultado Grave'),
    ],
  },
  {
    title: 'Verificar que el filtro Crítico + fechas devuelve 0 registros y la tabla aparece vacía',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Hacer clic en el botón de resultado CRÍTICO', expected: 'El botón queda activo (resaltado)' },
      BUSCAR('La tabla muestra 0 registros y aparece el mensaje "No data available"'),
    ],
  },
  {
    title: 'Verificar que la búsqueda por número de pedido + fechas devuelve resultados que incluyen ese pedido',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Introducir el número de pedido en el campo Nº de pedido', expected: 'El campo muestra el valor introducido' },
      BUSCAR('La tabla muestra al menos 1 resultado y el número de pedido aparece visible en la primera página'),
    ],
  },
  {
    title: 'Verificar que la búsqueda por artículo + fechas devuelve resultados',
    steps: [
      LOGIN_STEP,
      FECHA_DESDE_STEP,
      FECHA_HASTA_STEP,
      { content: 'Seleccionar el artículo en el campo Artículos', expected: 'El artículo queda seleccionado en el desplegable' },
      BUSCAR('La tabla muestra al menos 1 resultado para el artículo seleccionado'),
    ],
  },
  {
    title: 'Verificar que Generar DBF descarga un ZIP con certificadoFirmado_ y CertificadoSellado_ del código de instalación',
    steps: [
      LOGIN_STEP,
      { content: 'Establecer fechas 08/01/2026 - 09/01/2026 y hacer clic en BUSCAR (Periódicas activo)', expected: 'La tabla muestra 37 registros; se anota el Cod. Instalacion de la primera fila' },
      { content: 'Seleccionar la primera inspección de la tabla marcando su checkbox', expected: 'La fila queda seleccionada' },
      { content: 'Hacer clic en el botón GENERAR DBF', expected: 'Se descarga un fichero ZIP con nombre lote_X.zip' },
      {
        content: 'Abrir el ZIP y listar sus entradas',
        expected: 'El ZIP contiene al menos un fichero con prefijo certificadoFirmado_ y otro con CertificadoSellado_, ambos incluyendo el código de instalación de la fila seleccionada',
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
];

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // 1. Suite del proyecto
  const suites  = await tr('GET', `get_suites/${PROJECT_ID}`);
  const suiteId = suites.length ? suites[0].id : null;
  const suiteParam = suiteId ? `&suite_id=${suiteId}` : '';
  console.log(suiteId ? `Suite: [${suiteId}] ${suites[0].name}` : 'Modo single-suite');

  // 2. Buscar o crear sección "Madrid"
  const sectionsData = await tr('GET', `get_sections/${PROJECT_ID}${suiteParam}`);
  const allSections  = sectionsData.sections ?? sectionsData;
  let section = allSections.find(s => s.name.toLowerCase() === 'madrid');
  if (!section) {
    const body = { name: 'Madrid' };
    if (suiteId) body.suite_id = suiteId;
    section = await tr('POST', `add_section/${PROJECT_ID}`, body);
    console.log(`Sección "Madrid" creada: ID ${section.id}`);
  } else {
    console.log(`Sección "Madrid" encontrada: ID ${section.id}`);
  }

  // 3. Casos existentes
  const casesData = await tr('GET', `get_cases/${PROJECT_ID}${suiteParam}&section_id=${section.id}`);
  const existing  = casesData.cases ?? casesData;
  const byTitle   = new Map(existing.map(c => [c.title.trim(), c.id]));
  console.log(`Casos existentes en la sección: ${existing.length}\n`);

  // 4. Crear o reutilizar
  const mapping = [];
  for (const { title, steps } of CASES) {
    if (byTitle.has(title)) {
      const id = byTitle.get(title);
      mapping.push({ title, caseId: id });
      console.log(`  skip  C${id}  "${title}"`);
    } else {
      const created = await tr('POST', `add_case/${section.id}`, { title, custom_steps_separated: steps });
      mapping.push({ title, caseId: created.id });
      console.log(`  crear C${created.id}  "${title}"`);
    }
  }

  // 5. Guardar mapping
  const mappingPath = path.join(process.cwd(), 'scripts', 'testrail-mapping-madrid.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf8');

  console.log('\n── IDs de casos en TestRail ────────────────────────────');
  mapping.forEach(({ title, caseId }) => console.log(`  C${caseId}  ${title}`));
  console.log(`\nMapping guardado → scripts/testrail-mapping-madrid.json`);
})();
