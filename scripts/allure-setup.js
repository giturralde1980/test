/**
 * Prepara allure-results antes de generar el reporte:
 *  1. Rescata el histórico del reporte anterior (para el trend)
 *  2. Escribe environment.properties
 *  3. Copia categories.json desde allure-config/
 */
const fs = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const RESULTS_DIR  = path.join(ROOT, 'allure-results');
const REPORT_DIR   = path.join(ROOT, 'reports', 'allure-html');
const CONFIG_DIR   = path.join(ROOT, 'allure-config');

// ── 1. Histórico para el trend ────────────────────────────────────────────────
const historySource = path.join(REPORT_DIR, 'history');
const historyDest   = path.join(RESULTS_DIR, 'history');

if (fs.existsSync(historySource)) {
  fs.mkdirSync(historyDest, { recursive: true });
  for (const file of fs.readdirSync(historySource)) {
    fs.copyFileSync(
      path.join(historySource, file),
      path.join(historyDest, file)
    );
  }
  console.log('✓ Histórico copiado para trend');
} else {
  console.log('· Sin histórico previo — primer run');
}

// ── 2. environment.properties ─────────────────────────────────────────────────
// Lee .env manualmente (sin depender de dotenv en tiempo de setup)
const envFile = path.join(ROOT, '.env');
const envVars = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && !key.startsWith('#')) envVars[key.trim()] = rest.join('=').trim();
  }
}

const baseUrl  = envVars['BASE_URL']  || 'http://industria.ocaicp.com/';
const username = envVars['TEST_USERNAME'] || '';

const envProps = [
  'Environment=Producción',
  `URL=${baseUrl}`,
  `Usuario=${username}`,
  'Browser=Chromium',
  `Fecha=${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
].join('\n');

fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.writeFileSync(path.join(RESULTS_DIR, 'environment.properties'), envProps, 'utf8');
console.log('✓ environment.properties escrito');

// ── 3. categories.json ────────────────────────────────────────────────────────
const categoriesSrc  = path.join(CONFIG_DIR, 'categories.json');
const categoriesDest = path.join(RESULTS_DIR, 'categories.json');

if (fs.existsSync(categoriesSrc)) {
  fs.copyFileSync(categoriesSrc, categoriesDest);
  console.log('✓ categories.json copiado');
}
