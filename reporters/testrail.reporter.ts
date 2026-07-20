import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
  FullConfig,
  Suite,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

const TR_URL     = process.env.TESTRAIL_URL      || '';
const TR_USER    = process.env.TESTRAIL_USER     || '';
const TR_KEY     = process.env.TESTRAIL_API_KEY  || '';
const PROJECT_ID = parseInt(process.env.TESTRAIL_PROJECT_ID || '3', 10);
const SUITE_ID   = parseIntOrUndefined(process.env.TESTRAIL_SUITE_ID) ?? 7; // "Master", requerido por add_plan_entry

// Test Plans donde deben quedar agrupadas las ejecuciones de cada región.
// Hardcodeado de momento: https://oca.testrail.io/index.php?/plans/view/141 (Andalucía)
// y https://oca.testrail.io/index.php?/plans/view/140 (Madrid).
const PLAN_ID_BY_REGION: Record<string, number | undefined> = {
  TE_Andalucia: 141,
  TE_Madrid:    140,
};

function parseIntOrUndefined(v: string | undefined): number | undefined {
  const n = parseInt(v || '', 10);
  return Number.isNaN(n) ? undefined : n;
}

const STATUS: Record<string, number> = {
  passed:      1,
  failed:      5,
  timedOut:    5,
  skipped:     2,
  interrupted: 4,
};

const AUTH = Buffer.from(`${TR_USER}:${TR_KEY}`).toString('base64');

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[mGKHF]/g, '');
}

// Recoge recursivamente los títulos de los test.step() explícitos, en orden de ejecución.
// Se excluyen categorías internas de Playwright (expect, hook, fixture, pw:api) para no meter ruido.
function collectSteps(steps: TestStep[] = []): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (s.category === 'test.step') out.push(s.title);
    if (s.steps?.length) out.push(...collectSteps(s.steps));
  }
  return out;
}

function buildComment(result: TestResult): string {
  const steps = collectSteps(result.steps);
  const stepsBlock = steps.length
    ? `Pasos ejecutados:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  let header: string;
  if (result.status === 'passed') {
    header = 'Automatizado: PASSED';
  } else if (!result.error) {
    header = result.status;
  } else {
    const clean = stripAnsi(result.error.message ?? '');
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 4);
    header = `FAILED:\n${lines.join('\n')}`;
  }

  return [header, stepsBlock].filter(Boolean).join('\n\n');
}

async function trFetch(method: string, endpoint: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${TR_URL}/index.php?/api/v2/${endpoint}`, {
    method,
    headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TestRail [${res.status}] ${endpoint}: ${err}`);
  }
  return res.json();
}

async function uploadScreenshot(resultId: number, filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) return;

  const fileBuffer = fs.readFileSync(filePath);
  const blob       = new Blob([fileBuffer], { type: 'image/png' });
  const form       = new FormData();
  form.append('attachment', blob, path.basename(filePath));

  const res = await fetch(`${TR_URL}/index.php?/api/v2/add_attachment_to_result/${resultId}`, {
    method:  'POST',
    headers: { Authorization: `Basic ${AUTH}` },
    body:    form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[${res.status}] add_attachment_to_result/${resultId}: ${err}`);
  }
}

function buildRunName(prefix: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const env  = process.env.CI ? 'CI' : 'LOC';
  return `${prefix}_${date}_${time}_${env}`;
}

function getCaseIdsForRegion(prefix: string): number[] {
  const regionFile = prefix === 'TE_Madrid'
    ? 'testrail-mapping-madrid.json'
    : prefix === 'TE_Andalucia'
      ? 'testrail-mapping-andalucia.json'
      : null;

  if (!regionFile) {
    // Fallback: load all mappings
    const map: number[] = [];
    for (const file of ['testrail-mapping-andalucia.json', 'testrail-mapping-madrid.json']) {
      const p = path.join(process.cwd(), 'scripts', file);
      if (!fs.existsSync(p)) continue;
      const entries: Array<{ caseId: number }> = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const { caseId } of entries) map.push(caseId);
    }
    return map;
  }

  const p = path.join(process.cwd(), 'scripts', regionFile);
  if (!fs.existsSync(p)) return [];
  const entries: Array<{ caseId: number }> = JSON.parse(fs.readFileSync(p, 'utf8'));
  return entries.map(e => e.caseId);
}

function detectRegions(suite: Suite): string[] {
  // Env var override takes priority (useful for npm scripts)
  const envPrefix = process.env.TESTRAIL_RUN_PREFIX;
  if (envPrefix) return [envPrefix];

  // Auto-detect from test file paths — create one run per detected region
  const files: string[] = [];
  const collect = (s: Suite) => {
    for (const child of s.suites) collect(child);
    for (const t of s.tests) files.push(t.location?.file ?? '');
  };
  collect(suite);

  const hasMadrid    = files.some(f => f.toLowerCase().includes('madrid'));
  const hasAndalucia = files.some(f => f.toLowerCase().includes('andalucia'));

  const regions: string[] = [];
  if (hasAndalucia) regions.push('TE_Andalucia');
  if (hasMadrid)    regions.push('TE_Madrid');
  return regions.length ? regions : ['TE_Industria'];
}

function regionForFile(file: string): string | null {
  if (file.toLowerCase().includes('madrid'))    return 'TE_Madrid';
  if (file.toLowerCase().includes('andalucia')) return 'TE_Andalucia';
  return null;
}

interface PendingResult {
  case_id:         number;
  status_id:       number;
  comment?:        string;
  screenshotPath?: string;
}

interface RegionRun {
  runId:        number;
  planId?:      number;
  caseToTestId: Map<number, number>;
  pending:      Map<number, PendingResult>;
}

class TestRailReporter implements Reporter {
  private regions: Map<string, RegionRun> = new Map();
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.TESTRAIL_ENABLED === 'true' && !!TR_URL && !!TR_USER && !!TR_KEY;
  }

  async onBegin(_config: FullConfig, suite: Suite) {
    if (!this.enabled) return;

    const regionPrefixes = detectRegions(suite);
    const hasMappings = regionPrefixes.some(p => getCaseIdsForRegion(p).length > 0);
    if (!hasMappings) {
      console.warn('[TestRail] No se encontraron mappings. Ejecuta los scripts de sync primero.');
      return;
    }

    for (const prefix of regionPrefixes) {
      try {
        const caseIds = getCaseIdsForRegion(prefix);
        if (!caseIds.length) {
          console.warn(`[TestRail] Sin casos para ${prefix}, se omite el run.`);
          continue;
        }

        const name   = buildRunName(prefix);
        const planId = PLAN_ID_BY_REGION[prefix];

        let runId: number;
        if (planId) {
          const entry = await trFetch('POST', `add_plan_entry/${planId}`, {
            suite_id:    SUITE_ID,
            name,
            include_all: false,
            case_ids:    caseIds,
          }) as { runs?: Array<{ id: number }> };

          const createdRun = entry.runs?.[0];
          if (!createdRun) throw new Error(`add_plan_entry no devolvió ningún run para el plan ${planId}`);

          runId = createdRun.id;
          console.log(`\n[TestRail] Run "${name}" (ID ${runId}) añadido al plan ${planId}`);
        } else {
          const run = await trFetch('POST', `add_run/${PROJECT_ID}`, {
            name,
            include_all: false,
            case_ids:    caseIds,
          }) as { id: number; name: string };

          runId = run.id;
          console.log(`\n[TestRail] Test Run creado: "${run.name}" (ID ${run.id})`);
        }

        const tests = await trFetch('GET', `get_tests/${runId}`) as unknown;
        const testList = (
          Array.isArray(tests) ? tests : (tests as Record<string, unknown>).tests ?? []
        ) as Array<{ id: number; case_id: number }>;

        const caseToTestId = new Map<number, number>();
        for (const t of testList) caseToTestId.set(t.case_id, t.id);

        this.regions.set(prefix, { runId, planId, caseToTestId, pending: new Map() });
      } catch (e) {
        console.error(`[TestRail] Error al crear run para ${prefix}:`, (e as Error).message);
      }
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (!this.enabled || !this.regions.size) return;

    const annotation = test.annotations.find(a => a.type === 'testrail');
    if (!annotation?.description) return;

    const caseId = parseInt(annotation.description.replace('C', ''), 10);
    if (isNaN(caseId)) return;

    const statusId = STATUS[result.status] ?? 4;
    const comment  = buildComment(result);
    const screenshotAttachment = result.attachments.find(a => a.name === 'screenshot' && a.path);

    // Route to the correct region run by file path, fallback to whichever run has the case
    const file = test.location?.file ?? '';
    let regionKey = regionForFile(file);

    if (!regionKey || !this.regions.has(regionKey)) {
      for (const [key, region] of this.regions) {
        if (region.caseToTestId.has(caseId)) { regionKey = key; break; }
      }
    }

    if (!regionKey) return;
    const region = this.regions.get(regionKey);
    if (!region) return;

    // Overwrite on retry — only the final result is sent
    region.pending.set(caseId, {
      case_id:        caseId,
      status_id:      statusId,
      comment,
      screenshotPath: screenshotAttachment?.path,
    });
  }

  async onEnd() {
    if (!this.enabled || !this.regions.size) return;

    for (const [regionKey, region] of this.regions) {
      let screenshotsUploaded = 0;
      try {
        for (const p of region.pending.values()) {
          const testId = region.caseToTestId.get(p.case_id);
          if (!testId) continue;

          const res = await trFetch('POST', `add_result/${testId}`, {
            status_id: p.status_id,
            comment:   p.comment,
          }) as { id: number };

          if (p.screenshotPath) {
            try {
              await uploadScreenshot(res.id, p.screenshotPath);
              screenshotsUploaded++;
            } catch (e) {
              console.error(`[TestRail] Error al subir screenshot (C${p.case_id}):`, (e as Error).message);
            }
          }
        }

        console.log(`[TestRail] ${region.pending.size} resultado(s) → run ${region.runId} (${regionKey})`);
        if (screenshotsUploaded > 0) console.log(`[TestRail] ${screenshotsUploaded} screenshot(s) adjunto(s)`);

        if (region.planId) {
          // Los runs que pertenecen a un plan no se pueden cerrar de forma
          // independiente (TestRail lo rechaza con 403) — se cierran junto al plan.
          console.log(`[TestRail] Run ${region.runId} (${regionKey}) queda abierto dentro del plan ${region.planId}.\n`);
        } else {
          await trFetch('POST', `close_run/${region.runId}`, {});
          console.log(`[TestRail] Run ${region.runId} (${regionKey}) cerrado.\n`);
        }
      } catch (e) {
        console.error(`[TestRail] Error en onEnd (${regionKey}):`, (e as Error).message);
      }
    }
  }
}

export default TestRailReporter;
