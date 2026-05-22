export const TestData = {
  get credentials() {
    return {
      username: process.env.TEST_USERNAME || '',
      password: process.env.TEST_PASSWORD || '',
    };
  },
  urls: {
    base: process.env.BASE_URL || 'http://industriatest.ocaicp.com',
    login: '/',
    dashboard: '/andalucia',
  },
  tableHeaders: [
    'Pedido',
    'Línea',
    'Nº SIOCA',
    'Fecha Inspección',
    'Resultado',
    'Articulo',
    'Cod. Instalacion',
    'Dir. Instalacion',
    'Estado Inspeccion',
    'Estado Tramitacion',
  ],
  resultFilters: ['SIN DEFECTOS', 'LEVE A REPARAR', 'GRAVE', 'CRÍTICO'],
  timeouts: {
    short: 5_000,
    medium: 15_000,
    long: 30_000,
  },
};
