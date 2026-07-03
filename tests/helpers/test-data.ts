export const TestData = {
  get credentials() {
    return {
      username: process.env.TEST_USERNAME || '',
      password: process.env.TEST_PASSWORD || '',
    };
  },
  get madridCredentials() {
    return {
      username: process.env.MADRID_USERNAME || '',
      password: process.env.MADRID_PASSWORD || '',
    };
  },
  busquedas: {
    fechas: { desde: '2026-01-08', hasta: '2026-01-09' },
    totales: {
      porFechas:    165,
      sinDefectos:  100,
      leve:          33,
      grave:         32,
      critico:        0,
      articulo:       6,
    },
    pedido:   '00865637',
    articulo: '63010001RG',
  },
  madrid: {
    fechas: { desde: '2026-01-08', hasta: '2026-01-09' },
    totales: {
      periodicas:         37,
      correccionDefectos: 56,
      sinDefectos:        17,
      leve:                0,
      grave:              20,
      critico:             0,
    },
    pedido:   '00863791',
    articulo: '61010002RG',
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
  madridTableHeaders: [
    'Pedido',
    'Línea',
    'Nº Envío',
    'Nº Certificado',
    'Fecha Inspección',
    'Resultado',
    'Articulo',
    'Cod. Instalacion',
    'Dir. Instalacion',
    'Estado',
  ],
  resultFilters: ['SIN DEFECTOS', 'LEVE A REPARAR', 'GRAVE', 'CRÍTICO'],
  timeouts: {
    short: 5_000,
    medium: 15_000,
    long: 30_000,
  },
};
