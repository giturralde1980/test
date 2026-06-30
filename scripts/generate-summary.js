/**
 * Genera reports/summary.html — HTML autocontenido a partir del JUnit XML.
 * Screenshots de test-results/ se embeben como base64.
 * Abrirlo con doble click, imprimir a PDF o enviar por email.
 */
const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const XML_FILE     = path.join(ROOT, 'reports', 'junit', 'results.xml');
const RESULTS_DIR  = path.join(ROOT, 'reports', 'test-results');
const ENV_FILE     = path.join(ROOT, 'allure-results', 'environment.properties');
const OUTPUT_FILE  = path.join(ROOT, 'reports', 'summary.html');

// ── Helpers ───────────────────────────────────────────────────────────────────

function attr(str, name) {
  const m = str.match(new RegExp(`${name}="([^"]*)"`));
  return m ? decodeXml(m[1]) : '';
}

function decodeXml(s) {
  return (s || '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'");
}

function fmtTime(sec) {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(0).padStart(2, '0');
  return `${m}m ${s}s`;
}

// ── Leer environment.properties ───────────────────────────────────────────────

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && k.trim()) env[k.trim()] = v.join('=').trim();
    }
  }
  return env;
}

// ── Parsear JUnit XML ─────────────────────────────────────────────────────────

function parseJUnit(xml) {
  const suites = [];
  const suiteRx = /<testsuite\s([^>]*)>([\s\S]*?)<\/testsuite>/g;
  let sm;
  while ((sm = suiteRx.exec(xml)) !== null) {
    const sa = sm[1], body = sm[2];
    const suite = {
      name:     attr(sa, 'name'),
      tests:    parseInt(attr(sa, 'tests')    || '0'),
      failures: parseInt(attr(sa, 'failures') || '0'),
      errors:   parseInt(attr(sa, 'errors')   || '0'),
      skipped:  parseInt(attr(sa, 'skipped')  || '0'),
      time:     parseFloat(attr(sa, 'time')   || '0'),
      cases: [],
    };

    const caseRx = /<testcase\s([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let cm;
    while ((cm = caseRx.exec(body)) !== null) {
      const ca = cm[1], cb = cm[2] || '';
      let status = 'passed', message = '';
      const failM = cb.match(/<failure[^>]*message="([^"]*)"/);
      const errM  = cb.match(/<error[^>]*message="([^"]*)"/);
      if      (failM) { status = 'failed';  message = decodeXml(failM[1]); }
      else if (errM)  { status = 'broken';  message = decodeXml(errM[1]);  }
      else if (/<skipped/.test(cb)) { status = 'skipped'; }

      suite.cases.push({
        name:      attr(ca, 'name'),
        classname: attr(ca, 'classname'),
        time:      parseFloat(attr(ca, 'time') || '0'),
        status,
        message,
      });
    }
    suites.push(suite);
  }
  return suites;
}

// ── Buscar screenshots ────────────────────────────────────────────────────────

function findScreenshots() {
  const map = {};   // folderName → [base64png, ...]
  if (!fs.existsSync(RESULTS_DIR)) return map;
  for (const folder of fs.readdirSync(RESULTS_DIR)) {
    const folderPath = path.join(RESULTS_DIR, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    const pngs = fs.readdirSync(folderPath).filter(f => f.endsWith('.png'));
    if (pngs.length > 0) {
      map[folder] = pngs.map(f =>
        fs.readFileSync(path.join(folderPath, f)).toString('base64')
      );
    }
  }
  return map;
}

// Intenta relacionar el nombre del test con una carpeta de screenshots.
// Playwright genera nombres como: specs-andalucia-busqueda-A-446b4-chas-devuelve-165-registros-chromium
function matchScreenshots(testName, suiteName, screenshots) {
  // Normalizar: lowercase, solo alfanumérico
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const testNorm  = normalize(testName);
  const suiteNorm = normalize(suiteName.replace(/tests[\\/]specs[\\/]/i, '').replace(/\.spec\.ts$/i, ''));

  let best = null, bestScore = 0;

  for (const [folder, imgs] of Object.entries(screenshots)) {
    const folderNorm = normalize(folder);
    // Cuenta palabras del test que aparecen en el folder (mínimo 4 chars)
    const words = testNorm.split('-').filter(w => w.length >= 4);
    const score = words.filter(w => folderNorm.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = imgs; }
  }
  return bestScore >= 2 ? best : null;
}

// ── Generar HTML ──────────────────────────────────────────────────────────────

function badge(status) {
  const cfg = {
    passed:  { bg: '#22c55e', text: '#fff', label: '✓ OK'      },
    failed:  { bg: '#ef4444', text: '#fff', label: '✗ FALLO'   },
    broken:  { bg: '#f97316', text: '#fff', label: '⚠ ROTO'    },
    skipped: { bg: '#94a3b8', text: '#fff', label: '– OMITIDO' },
  };
  const c = cfg[status] || cfg.skipped;
  return `<span style="background:${c.bg};color:${c.text};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap">${c.label}</span>`;
}

function generateHtml(suites, env, screenshots) {
  const now       = new Date();
  const dateStr   = now.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr   = now.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });

  const totalTests  = suites.reduce((a, s) => a + s.tests, 0);
  const totalFail   = suites.reduce((a, s) => a + s.failures + s.errors, 0);
  const totalSkip   = suites.reduce((a, s) => a + s.skipped, 0);
  const totalPassed = totalTests - totalFail - totalSkip;
  const totalTime   = suites.reduce((a, s) => a + s.time, 0);
  const pct         = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
  const pctColor    = pct === 100 ? '#22c55e' : pct >= 80 ? '#f97316' : '#ef4444';

  const envRows = Object.entries(env).map(([k, v]) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${k}</td><td style="padding:4px 0;font-size:13px;font-weight:500">${v}</td></tr>`
  ).join('');

  const suiteBlocks = suites.map(suite => {
    const specName = suite.name
      .replace(/tests[\\/]specs[\\/]/gi, '')
      .replace(/tests[\\/]utils[\\/]/gi, 'utils/')
      .replace(/\.spec\.ts$/i, '');

    const suiteFail = suite.failures + suite.errors;
    const headerBg  = suiteFail > 0 ? '#fef2f2' : '#f0fdf4';
    const headerBorder = suiteFail > 0 ? '#fca5a5' : '#86efac';

    const rows = suite.cases.map(tc => {
      const imgs    = matchScreenshots(tc.name, suite.name, screenshots);
      const imgHtml = imgs ? imgs.map((b64, i) => {
        const id = `img-${Math.random().toString(36).slice(2)}`;
        return `
          <div style="margin-top:8px">
            <img id="${id}" src="data:image/png;base64,${b64}"
              style="max-width:100%;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;max-height:120px;object-fit:contain"
              onclick="this.style.maxHeight=this.style.maxHeight==='none'?'120px':'none'"
              title="Click para ampliar"/>
          </div>`;
      }).join('') : '';

      const msgHtml = tc.message
        ? `<div style="margin-top:6px;font-size:11px;color:#dc2626;font-family:monospace;background:#fef2f2;padding:6px 8px;border-radius:4px;overflow-x:auto;white-space:pre-wrap">${escHtml(tc.message.slice(0, 300))}${tc.message.length > 300 ? '…' : ''}</div>`
        : '';

      return `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:10px 12px;width:90px;text-align:center">${badge(tc.status)}</td>
          <td style="padding:10px 12px">
            <div style="font-size:13px;color:#1e293b">${escHtml(tc.name)}</div>
            ${msgHtml}${imgHtml}
          </td>
          <td style="padding:10px 12px;text-align:right;color:#64748b;font-size:12px;white-space:nowrap">${fmtTime(tc.time)}</td>
        </tr>`;
    }).join('');

    return `
      <div style="margin-bottom:28px;border:1px solid ${headerBorder};border-radius:8px;overflow:hidden">
        <div style="background:${headerBg};padding:10px 16px;border-bottom:1px solid ${headerBorder};display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600;font-size:14px;color:#1e293b">${escHtml(specName)}</span>
          <span style="font-size:12px;color:#64748b">${suite.tests} tests · ${fmtTime(suite.time)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>QA Report — ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
    @media print {
      body { background: #fff; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div style="max-width:900px;margin:0 auto;padding:32px 24px">

    <!-- HEADER -->
    <div style="background:#1e3a5f;color:#fff;border-radius:10px;padding:24px 28px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:22px;font-weight:700">QA Report — Industria</div>
        <div style="font-size:13px;opacity:.75;margin-top:4px">${dateStr} · ${timeStr}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:40px;font-weight:800;color:${pctColor};line-height:1">${pct}%</div>
        <div style="font-size:12px;opacity:.7;margin-top:2px">tests OK</div>
      </div>
    </div>

    <!-- SUMMARY CARDS -->
    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">
      ${card('Total', totalTests, '#3b82f6')}
      ${card('Pasaron', totalPassed, '#22c55e')}
      ${card('Fallaron', totalFail, totalFail > 0 ? '#ef4444' : '#94a3b8')}
      ${card('Omitidos', totalSkip, '#94a3b8')}
      ${card('Duración', fmtTime(totalTime), '#8b5cf6', true)}
    </div>

    <!-- ENVIRONMENT -->
    ${envRows ? `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <div style="font-weight:600;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Entorno</div>
      <table>${envRows}</table>
    </div>` : ''}

    <!-- SUITE BLOCKS -->
    <div style="font-weight:600;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Resultados por spec</div>
    ${suiteBlocks}

    <div class="no-print" style="text-align:center;margin-top:32px;font-size:12px;color:#94a3b8">
      Generado por <strong>generate-summary.js</strong> · Playwright + Allure
    </div>
  </div>
</body>
</html>`;
}

function card(label, value, color, isText = false) {
  return `
    <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;text-align:center">
      <div style="font-size:${isText ? '22px' : '28px'};font-weight:700;color:${color}">${value}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">${label}</div>
    </div>`;
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(XML_FILE)) {
  console.error(`✗ No se encontró ${XML_FILE}\n  Ejecutá npm test primero.`);
  process.exit(1);
}

const xml         = fs.readFileSync(XML_FILE, 'utf8');
const allSuites   = parseJUnit(xml);
const suites      = allSuites.filter(s => /busqueda/i.test(s.name));
const env         = readEnv();
const screenshots = findScreenshots();
const html        = generateHtml(suites, env, screenshots);

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, html, 'utf8');

const total   = suites.reduce((a, s) => a + s.tests, 0);
const failed  = suites.reduce((a, s) => a + s.failures + s.errors, 0);
console.log(`✓ Reporte generado: ${OUTPUT_FILE}`);
console.log(`  ${total} tests · ${total - failed} OK · ${failed} fallaron`);
