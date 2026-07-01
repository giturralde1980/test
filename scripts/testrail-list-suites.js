// Lista suites del proyecto TestRail
require('dotenv').config();

const url = process.env.TESTRAIL_URL;
const user = process.env.TESTRAIL_USER;
const apiKey = process.env.TESTRAIL_API_KEY;
const projectId = process.argv[2] || '3';

const base64Auth = Buffer.from(`${user}:${apiKey}`).toString('base64');

async function get(path) {
  const res = await fetch(`${url}/index.php?/api/v2/${path}`, {
    headers: { 'Authorization': `Basic ${base64Auth}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

(async () => {
  const suites = await get(`get_suites/${projectId}`);
  console.log(`\nProject ID ${projectId} — Suites (${suites.length}):`);
  suites.forEach(s => console.log(`  [${s.id}] ${s.name}`));

  for (const suite of suites) {
    const sections = await get(`get_sections/${projectId}&suite_id=${suite.id}`);
    const list = sections.sections ?? sections;
    console.log(`\n  Suite [${suite.id}] "${suite.name}" — Sections:`);
    list.forEach(s => console.log(`    [${s.id}] ${s.name}`));
  }
})();
