// ─────────────────────────────────────────────────────────────────────────────
// XRAY IMPORT — pendiente de evaluación
// Para activar: descomentar XRAY_* en el archivo .env
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

const XRAY_AUTH_URL   = 'https://xray.cloud.getxray.app/api/v2/authenticate';
const XRAY_IMPORT_URL = 'https://xray.cloud.getxray.app/api/v2/import/execution/junit';
const XML_PATH        = path.resolve('reports/junit/results.xml');

interface XrayImportResult {
  key: string;
}

async function authenticate(): Promise<string> {
  const res = await fetch(XRAY_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.XRAY_CLIENT_ID,
      client_secret: process.env.XRAY_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Xray auth failed [${res.status}]: ${await res.text()}`);
  }

  // Xray devuelve el token como string entre comillas: "eyJ..."
  const raw = await res.text();
  return raw.replace(/^"|"$/g, '');
}

async function importResults(token: string): Promise<XrayImportResult> {
  const xml = fs.readFileSync(XML_PATH, 'utf8');
  const formData = new FormData();
  formData.append('file', new Blob([xml], { type: 'text/xml' }), 'results.xml');

  const url = `${XRAY_IMPORT_URL}?projectKey=${process.env.XRAY_PROJECT_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Xray import failed [${res.status}]: ${await res.text()}`);
  }

  return res.json() as Promise<XrayImportResult>;
}

async function main(): Promise<void> {
  const clientId     = process.env.XRAY_CLIENT_ID;
  const clientSecret = process.env.XRAY_CLIENT_SECRET;
  const projectKey   = process.env.XRAY_PROJECT_KEY;

  if (!clientId || !clientSecret || !projectKey) {
    console.error('\nFaltan variables en .env:');
    if (!clientId)     console.error('  - XRAY_CLIENT_ID');
    if (!clientSecret) console.error('  - XRAY_CLIENT_SECRET');
    if (!projectKey)   console.error('  - XRAY_PROJECT_KEY');
    process.exit(1);
  }

  if (!fs.existsSync(XML_PATH)) {
    console.error(`\nNo se encontró el XML: ${XML_PATH}`);
    console.error('Corré los tests primero: npx playwright test');
    process.exit(1);
  }

  console.log('\n→ Autenticando con Xray Cloud...');
  const token = await authenticate();
  console.log('  OK');

  console.log(`→ Importando resultados al proyecto ${projectKey}...`);
  const result = await importResults(token);
  console.log('  OK\n');

  console.log('╔══════════════════════════════════════════╗');
  console.log(`  Test Execution creada: ${result.key}`);
  console.log(`  ${process.env.JIRA_BASE_URL}/browse/${result.key}`);
  console.log('╚══════════════════════════════════════════╝\n');
}

main().catch((err: Error) => {
  console.error('\n✖ Error:', err.message);
  process.exit(1);
});
