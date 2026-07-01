// Script de verificación de conexión a TestRail
require('dotenv').config();

const url = process.env.TESTRAIL_URL;
const user = process.env.TESTRAIL_USER;
const apiKey = process.env.TESTRAIL_API_KEY;

if (!url || !user || !apiKey) {
  console.error('Faltan variables TESTRAIL_URL, TESTRAIL_USER o TESTRAIL_API_KEY en .env');
  process.exit(1);
}

const base64Auth = Buffer.from(`${user}:${apiKey}`).toString('base64');
const endpoint = `${url}/index.php?/api/v2/get_projects`;

console.log(`Conectando a: ${endpoint}`);
console.log(`Usuario: ${user}`);

fetch(endpoint, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${base64Auth}`,
    'Content-Type': 'application/json',
  },
})
  .then(async (res) => {
    const body = await res.json();
    if (!res.ok) {
      console.error(`Error HTTP ${res.status}:`, JSON.stringify(body, null, 2));
      process.exit(1);
    }
    const projects = body.projects ?? body;
    console.log(`\nConexión exitosa. Proyectos disponibles (${projects.length}):`);
    projects.forEach((p) => console.log(`  [${p.id}] ${p.name}`));
  })
  .catch((err) => {
    console.error('Error de red:', err.message);
    process.exit(1);
  });
