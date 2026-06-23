// ENVOX Intelligence — Mock Data (fallback quando API não responde)
(function () {
  'use strict';
  window.TC_MOCK = {
    company: 'ENVOX',
    userName: 'Admin',
    lastUpdate: new Date().toLocaleString('pt-BR'),
    kpis: [
      { id: 'msgs',      label: 'Mensagens Hoje',   value: 0,  colorTheme: 'default' },
      { id: 'groups',    label: 'Grupos Ativos',    value: 0,  colorTheme: 'default' },
      { id: 'alerts',    label: 'Alertas Abertos',  value: 0,  colorTheme: 'alert'   },
      { id: 'opps',      label: 'Oportunidades',    value: 0,  colorTheme: 'success' },
      { id: 'followups', label: 'Follow-ups Pend.', value: 0,  colorTheme: 'warning' },
      { id: 'churn',     label: 'Riscos Churn',     value: 0,  colorTheme: 'orange'  },
    ],
    temperatureScore: 0,
    trends: [],
    alerts: [],
    groups: [],
    team: [],
    summaryData: { highlights: [], risks: [], opportunities: [], actions: [] },
  };
})();
