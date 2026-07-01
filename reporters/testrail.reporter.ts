import type {
  Reporter,
  TestCase,
  TestResult,
  FullConfig,
  Suite,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

const TR_URL     = process.env.TESTRAIL_URL      || '';
const TR_USER    = process.env.TESTRAIL_USER     || '';
const TR_KEY     = process.env.TESTRAIL_API_KEY  || '';
const PROJECT_ID = parseInt(process.env.TESTRAIL_PROJECT_ID || '3', 10);

const STATUS: Record<string, number> = {
  passed:      1,
  failed:      5,
  timedOut:    5,
  skipped:     2,
  interrupted: 4,
};

const AUTH = Buffer.from(`${TR_USER}:${TR_KEY}`).toString('base64');

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
  return `${prefix}_${date}_${time}`;
}

function detectRegion(suite: Suite): string {
  // Env var override takes priority (useful for npm scripts)
  const envPrefix = process.env.TESTRAIL_RUN_PREFIX;
  if (envPrefix) return envPrefix;

  // Auto-detect from test file paths in the suite
  const titles: string[] = [];
  const collect = (s: Suite) => {
    for (const child of s.suites) collect(child);
    for (const t of s.tests) titles.push(t.location?.file ?? '');
  };
  collect(suite);

  const hasMadrid    = titles.some(f => f.toLowerCase().includes('madrid'));
  const hasAndalucia = titles.some(f => f.toLowerCase().includes('andalucia'));

  if (hasMadrid && !hasAndalucia) return 'TE_Madrid';
  if (hasAndalucia && !hasMadrid) return 'TE_Andalucia';
  // Both or neither: fall back to generic name
  return 'TE_Industria';
}

function loadAllMappings(): Map<number, string> {
  const map = new Map<number, string>();
  const files = ['testrail-mapping-andalucia.json', 'testrail-mapping-madrid.json'];
  for (const file of files) {
    const p = path.join(process.cwd(), 'scripts', file);
    if (!fs.existsSync(p)) continue;
    const entries: Array<{ title: string; caseId: number }> = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const { caseId, title } of entries) map.set(caseId, title);
  }
  return map;
}

interface PendingResult {
  case_id:         number;
  status_id:       number;
  comment?:        string;
  screenshotPath?: string;
}

class TestRailReporter implements Reporter {
  private runId:        number | null = null;
  private caseToTestId: Map<number, number> = new Map();
  private pending:      PendingResult[] = [];
  private enabled:      boolean;

  constructor() {
    this.enabled = process.env.TESTRAIL_ENABLED === 'true' && !!TR_URL && !!TR_USER && !!TR_KEY;
  }

  async onBegin(_config: FullConfig, suite: Suite) {
    if (!this.enabled) return;
    try {
      const allCases = loadAllMappings();
      if (!allCases.size) {
        console.warn('[TestRail] No se encontraron mappings. Ejecuta los scripts de sync primero.');
        return;
      }

      const prefix  = detectRegion(suite);
      const name    = buildRunName(prefix);

      // Only include case IDs that belong to the detected region's mapping file
      const regionFile = prefix === 'TE_Madrid'
        ? 'testrail-mapping-madrid.json'
        : prefix === 'TE_Andalucia'
          ? 'testrail-mapping-andalucia.json'
          : null;

      let caseIds: number[];
      if (regionFile) {
        const p = path.join(process.cwd(), 'scripts', regionFile);
        const entries: Array<{ caseId: number }> = fs.existsSync(p)
          ? JSON.parse(fs.readFileSync(p, 'utf8'))
          : [];
        caseIds = entries.map(e => e.caseId);
      } else {
        caseIds = [...allCases.keys()];
      }

      // Crear el run
      const run = await trFetch('POST', `add_run/${PROJECT_ID}`, {
        name,
        include_all: false,
        case_ids:    caseIds,
      }) as { id: number; name: string };
      this.runId = run.id;
      console.log(`\n[TestRail] Test Run creado: "${run.name}" (ID ${this.runId})`);

      // Obtener mapping case_id → test_id
      const tests = await trFetch('GET', `get_tests/${this.runId}`) as unknown;
      const testList = (
        Array.isArray(tests) ? tests : (tests as Record<string, unknown>).tests ?? []
      ) as Array<{ id: number; case_id: number }>;
      for (const t of testList) {
        this.caseToTestId.set(t.case_id, t.id);
      }
    } catch (e) {
      console.error('[TestRail] Error al crear el run:', (e as Error).message);
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (!this.enabled || this.runId === null) return;

    const annotation = test.annotations.find(a => a.type === 'testrail');
    if (!annotation?.description) return;

    const caseId = parseInt(annotation.description.replace('C', ''), 10);
    if (isNaN(caseId)) return;

    const statusId = STATUS[result.status] ?? 4;
    const comment  = result.error
      ? `FAILED: ${result.error.message?.split('\n')[0] ?? ''}`
      : result.status === 'passed' ? 'Automatizado: PASSED' : result.status;

    const screenshotAttachment = result.attachments.find(
      a => a.name === 'screenshot' && a.path
    );

    this.pending.push({
      case_id:        caseId,
      status_id:      statusId,
      comment,
      screenshotPath: screenshotAttachment?.path,
    });
  }

  async onEnd() {
    if (!this.enabled || this.runId === null || !this.pending.length) return;

    let screenshotsUploaded = 0;

    try {
      for (const p of this.pending) {
        const testId = this.caseToTestId.get(p.case_id);
        if (!testId) continue;

        const result = await trFetch('POST', `add_result/${testId}`, {
          status_id: p.status_id,
          comment:   p.comment,
        }) as { id: number };

        if (p.screenshotPath) {
          try {
            await uploadScreenshot(result.id, p.screenshotPath);
            screenshotsUploaded++;
          } catch (e) {
            console.error(`[TestRail] Error al subir screenshot (C${p.case_id}):`, (e as Error).message);
          }
        }
      }

      console.log(`[TestRail] ${this.pending.length} resultado(s) enviado(s) al run ${this.runId}`);
      if (screenshotsUploaded > 0) {
        console.log(`[TestRail] ${screenshotsUploaded} screenshot(s) adjunto(s)`);
      }

      await trFetch('POST', `close_run/${this.runId}`, {});
      console.log(`[TestRail] Run ${this.runId} cerrado.\n`);
    } catch (e) {
      console.error('[TestRail] Error en onEnd:', (e as Error).message);
    }
  }
}

export default TestRailReporter;
