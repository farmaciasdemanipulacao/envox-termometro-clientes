// tc-screens-b.jsx — GroupsScreen, SummaryScreen, TeamScreen, ApiDocsScreen, ConfigScreen

// ─────────────────────────────────────────────────────────────
// GroupsScreen — dados reais da API
// ─────────────────────────────────────────────────────────────
function GroupsScreen({ onSelectGroup }) {
  const [groups, setGroups]   = React.useState([]);
  const [search, setSearch]   = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.apiGet('/dashboard/groups').then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => setGroups([])).finally(() => setLoading(false));
  }, []);

  const filtered = groups.filter(g => (g.conversation_name || '').toLowerCase().includes(search.toLowerCase()));
  const tempColor = (s) => s >= 80 ? '#16a34a' : s >= 60 ? '#2563eb' : s >= 40 ? '#ca8a04' : s >= 20 ? '#ea580c' : '#dc2626';
  const tempBg    = (s) => s >= 80 ? '#f0fdf4' : s >= 60 ? '#eff6ff' : s >= 40 ? '#fefce8' : s >= 20 ? '#fff7ed' : '#fef2f2';

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Grupos em Monitoramento" subtitle={groups.length + ' grupos ativos'} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ position: 'relative', maxWidth: '360px' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px' }}></i>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo..."
            style={{ width: '100%', padding: '9px 12px 9px 34px', boxSizing: 'border-box', border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />
        </div>

        {loading
          ? <div style={{ textAlign: 'center', padding: '48px' }}><Spinner size={24} color="#2563eb" /></div>
          : filtered.length === 0
            ? <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                {groups.length === 0 ? 'Nenhum grupo monitorado ainda. Ingira dados via API.' : 'Nenhum grupo encontrado.'}
              </div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', animation: 'fadeInUp 0.35s ease' }}>
                {filtered.map(g => (
                  <div key={g.conversation_id} onClick={() => onSelectGroup && onSelectGroup(g)} style={{ cursor: onSelectGroup ? 'pointer' : 'default' }}>
                    <DsCard style={{ padding: '20px', transition: 'transform 0.2s, box-shadow 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.conversation_name}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>{g.total_messages || 0} msg hoje</div>
                        </div>
                        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: tempColor(g.temperature_score || 0), background: tempBg(g.temperature_score || 0), padding: '4px 10px', borderRadius: 'var(--radius-lg)', marginLeft: '8px', flexShrink: 0 }}>
                          {g.temperature_score || 0}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: g.risk_score >= 60 ? '#dc2626' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fas fa-shield-alt"></i> Risco: {(g.risk_score || 0).toFixed(0)}/100
                        </div>
                        {(g.open_alerts || 0) > 0 && (
                          <div style={{ fontSize: 'var(--text-xs)', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fas fa-bell"></i> {g.open_alerts} alerta(s)
                          </div>
                        )}
                        {(g.followups_pending || 0) > 0 && (
                          <div style={{ fontSize: 'var(--text-xs)', color: '#ca8a04', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fas fa-clock"></i> {g.followups_pending} follow-up
                          </div>
                        )}
                      </div>
                    </DsCard>
                  </div>
                ))}
              </div>
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryScreen — dados reais da API
// ─────────────────────────────────────────────────────────────
function SummaryScreen({ onNavigateAlerts }) {
  const [summary, setSummary]   = React.useState(null);
  const [loading, setLoading]   = React.useState(true);
  const [generating, setGen]    = React.useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await window.apiGet('/summaries/today');
      setSummary(d);
    } catch(e) { setSummary(null); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setGen(true);
    window.showToast('Gerando resumo executivo...', 'info');
    try {
      await window.apiPost('/summaries/generate');
      window.showToast('Resumo gerado!', 'success');
      load();
    } catch(e) { window.showToast('Erro: ' + e.message, 'error'); }
    finally { setGen(false); }
  };

  const tempColors = { excellent: '#16a34a', good: '#2563eb', attention: '#ca8a04', warning: '#ea580c', critical: '#dc2626' };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Resumo Executivo"
        subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <button onClick={handleGenerate} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
            {generating ? <><Spinner size={12} />&nbsp; Gerando...</> : <><i className="fas fa-magic"></i>&nbsp; {summary ? 'Regerar Resumo' : 'Gerar Resumo'}</>}
          </button>
        }
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        {loading
          ? <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={28} color="#2563eb" /></div>
          : !summary
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '16px', animation: 'fadeIn 0.4s ease' }}>
                <div style={{ width: '72px', height: '72px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-magic" style={{ fontSize: '28px', color: '#2563eb' }}></i>
                </div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Resumo ainda não gerado</h3>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '380px' }}>
                  Clique em "Gerar Resumo" para consolidar os dados de hoje em um relatório executivo.
                </p>
                <button onClick={handleGenerate} style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                  <i className="fas fa-magic" style={{ marginRight: '8px' }}></i>Gerar Resumo do Dia
                </button>
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeInUp 0.5s ease' }}>
                {/* Header do resumo */}
                <DsCard>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-card)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Resumo de {new Date(summary.summary_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', marginTop: '2px' }}>Gerado via {summary.generation_method === 'heuristic' ? 'Heurísticas' : 'IA'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '32px', fontWeight: 700, color: tempColors[summary.temperature_label] || '#374151' }}>{summary.temperature_score}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Termômetro</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: (summary.executive_text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n\n/g, '</p><p style="margin-top:12px">') }}></div>
                </DsCard>

                {/* Destaques */}
                {summary.highlights?.length > 0 && (
                  <DsCard>
                    <SectionTitle icon="star" label="Destaques do Dia" color="#2563eb" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {summary.highlights.map((h, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: '#eff6ff', borderRadius: 'var(--radius-lg)' }}>
                          <i className="fas fa-check-circle" style={{ color: '#2563eb', marginTop: '2px', flexShrink: 0 }}></i>
                          <span style={{ fontSize: 'var(--text-sm)', color: '#1e40af' }}>{h}</span>
                        </div>
                      ))}
                    </div>
                  </DsCard>
                )}

                {/* Pontos críticos e oportunidades */}
                <div style={{ display: 'grid', gridTemplateColumns: summary.opportunities?.length ? '1fr 1fr' : '1fr', gap: '20px' }}>
                  {summary.critical_points?.length > 0 && (
                    <DsCard>
                      <SectionTitle icon="exclamation-triangle" label="Pontos Críticos" color="#dc2626" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {summary.critical_points.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: '#fef2f2', borderRadius: 'var(--radius-lg)' }}>
                            <i className="fas fa-exclamation-circle" style={{ color: '#dc2626', marginTop: '2px', flexShrink: 0 }}></i>
                            <span style={{ fontSize: 'var(--text-sm)', color: '#991b1b' }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    </DsCard>
                  )}
                  {summary.opportunities?.length > 0 && (
                    <DsCard>
                      <SectionTitle icon="lightbulb" label="Oportunidades" color="#16a34a" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {summary.opportunities.map((o, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: '#f0fdf4', borderRadius: 'var(--radius-lg)' }}>
                            <i className="fas fa-lightbulb" style={{ color: '#16a34a', marginTop: '2px', flexShrink: 0 }}></i>
                            <span style={{ fontSize: 'var(--text-sm)', color: '#166534' }}>{o}</span>
                          </div>
                        ))}
                      </div>
                    </DsCard>
                  )}
                </div>
              </div>
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TeamScreen
// ─────────────────────────────────────────────────────────────
function TeamScreen() {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Time" subtitle="Performance dos colaboradores" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        <DsCard style={{ textAlign: 'center', padding: '64px 32px' }}>
          <i className="fas fa-chart-line" style={{ fontSize: '48px', color: '#cbd5e1', display: 'block', marginBottom: '16px' }}></i>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Em breve</h3>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>
            Dados de performance do time serão exibidos aqui conforme as métricas forem acumuladas via WhatsApp.
          </p>
        </DsCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ApiDocsScreen
// ─────────────────────────────────────────────────────────────
function ApiDocsScreen() {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="API Docs" subtitle="Documentação interativa da API" actions={
        <a href="/docs" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#2563eb', color: 'white', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', textDecoration: 'none', fontWeight: 500 }}>
          <i className="fas fa-external-link-alt"></i> Abrir Swagger UI
        </a>
      } />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DsCard>
          <SectionTitle icon="info-circle" label="Sobre a API" color="#2563eb" />
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            A API REST do ENVOX Intelligence permite ingestão de mensagens, consulta de métricas e gerenciamento de alertas.
            Acesse a documentação interativa completa no Swagger UI.
          </p>
          <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--radius-lg)', fontFamily: 'monospace', fontSize: '13px', color: '#334155' }}>
            Base URL: <strong>/api/v1</strong>
          </div>
        </DsCard>

        {[
          { method: 'POST', path: '/auth/token',          desc: 'Autenticação — obtém JWT token',               auth: false },
          { method: 'GET',  path: '/dashboard/overview',  desc: 'Visão geral com KPIs e termômetro',             auth: true  },
          { method: 'GET',  path: '/dashboard/groups',    desc: 'Lista grupos monitorados com métricas',          auth: true  },
          { method: 'GET',  path: '/alerts',              desc: 'Lista alertas (filtros: status, severity)',      auth: true  },
          { method: 'PATCH',path: '/alerts/{id}',         desc: 'Atualiza status do alerta (resolved/acknowledged)', auth: true },
          { method: 'GET',  path: '/summaries/today',     desc: 'Resumo executivo do dia atual',                 auth: true  },
          { method: 'POST', path: '/summaries/generate',  desc: 'Força geração de novo resumo',                  auth: true  },
          { method: 'POST', path: '/ingest/message',      desc: 'Ingere mensagem individual',                    auth: false },
          { method: 'POST', path: '/ingest/batch',        desc: 'Ingere lote de mensagens',                      auth: false },
          { method: 'GET',  path: '/health',              desc: 'Healthcheck da API',                             auth: false },
        ].map((ep, i) => {
          const mc = { GET: '#dbeafe', POST: '#dcfce7', PATCH: '#fef9c3', PUT: '#fef9c3', DELETE: '#fee2e2' };
          const tc = { GET: '#1e40af', POST: '#166534', PATCH: '#854d0e', PUT: '#854d0e', DELETE: '#991b1b' };
          return (
            <DsCard key={i} style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: mc[ep.method] || '#f1f5f9', color: tc[ep.method] || '#374151', fontFamily: 'monospace', minWidth: '52px', textAlign: 'center' }}>{ep.method}</span>
                <code style={{ fontSize: '13px', color: '#334155', fontFamily: 'monospace', flex: 1 }}>/api/v1{ep.path}</code>
                {ep.auth && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: '#fef9c3', color: '#854d0e' }}>🔒 JWT</span>}
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{ep.desc}</p>
            </DsCard>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ConfigScreen — Configurações do sistema
// ─────────────────────────────────────────────────────────────
function ConfigScreen() {
  const [wppUrl, setWppUrl]       = React.useState(localStorage.getItem('cfg_wpp_url') || 'http://187.127.6.191:21465');
  const [wppSecret, setWppSecret] = React.useState(localStorage.getItem('cfg_wpp_secret') || 'THISISMYSECURETOKEN');
  const [wppSession, setWppSession] = React.useState(localStorage.getItem('cfg_wpp_session') || 'termonitor');
  const [apiKey, setApiKey]       = React.useState('');
  const [domain, setDomain]       = React.useState(localStorage.getItem('cfg_domain') || window.location.host);
  const [saving, setSaving]       = React.useState(false);
  const [healthStatus, setHealth] = React.useState(null);

  React.useEffect(() => {
    window.apiGet('/health').then(d => setHealth(d)).catch(() => setHealth({ status: 'error' }));
  }, []);

  const saveConfig = () => {
    setSaving(true);
    localStorage.setItem('cfg_wpp_url', wppUrl);
    localStorage.setItem('cfg_wpp_secret', wppSecret);
    localStorage.setItem('cfg_wpp_session', wppSession);
    localStorage.setItem('cfg_domain', domain);
    setTimeout(() => { setSaving(false); window.showToast('Configurações salvas!', 'success'); }, 500);
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none',
    background: 'white', color: 'var(--color-text-primary)',
  };
  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' };

  const Section = ({ icon, title, children }) => (
    <DsCard>
      <SectionTitle icon={icon} label={title} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{children}</div>
    </DsCard>
  );

  const Field = ({ label, value, onChange, type = 'text', hint }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
      {hint && <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', marginTop: '4px' }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Configurações" subtitle="Gerencie integrações e parâmetros do sistema"
        actions={
          <button onClick={saveConfig} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
            {saving ? <><Spinner size={12} />&nbsp; Salvando...</> : <><i className="fas fa-save"></i>&nbsp; Salvar</>}
          </button>
        }
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Status do sistema */}
        <DsCard style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: (healthStatus?.status === 'ok' || healthStatus?.status === 'healthy') ? '#22c55e' : healthStatus?.status === 'error' ? '#ef4444' : '#94a3b8', flexShrink: 0 }}></div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Status do Backend: {(healthStatus?.status === 'ok' || healthStatus?.status === 'healthy') ? '✅ Online' : healthStatus?.status === 'error' ? '❌ Offline' : '⏳ Verificando...'}
              </div>
              {healthStatus?.version && <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8' }}>Versão {healthStatus.version} · {healthStatus.environment} · DB: {healthStatus.database}</div>}
            </div>
          </div>
        </DsCard>

        {/* WhatsApp */}
        <Section icon="whatsapp fab" title="Conexão WhatsApp (WPPConnect)">
          <Field label="URL do servidor WPPConnect" value={wppUrl} onChange={setWppUrl} hint="Ex: http://187.127.6.191:21465" />
          <Field label="Token secreto" value={wppSecret} onChange={setWppSecret} type="password" hint="Secret configurado no WPPConnect" />
          <Field label="Nome da sessão" value={wppSession} onChange={setWppSession} hint="Ex: termonitor" />
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: 'var(--text-xs)', color: '#854d0e' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
            Para conectar o WhatsApp, vá em <strong>Conexão WhatsApp</strong> no menu lateral após salvar as configurações.
          </div>
        </Section>

        {/* API Key */}
        <Section icon="key" title="API Key para Ingestão">
          <Field label="API Key atual" value={apiKey} onChange={setApiKey} type="password" hint="Configurada no arquivo .env do servidor (API_KEY_SECRET)" />
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: 'var(--text-xs)', color: '#1e40af' }}>
            <i className="fas fa-code" style={{ marginRight: '6px' }}></i>
            Use esta key no header <code>X-API-Key</code> para ingerir mensagens via <code>POST /api/v1/ingest/message</code>
          </div>
        </Section>

        {/* Domínio */}
        <Section icon="globe" title="Domínio / Acesso">
          <Field label="Domínio da aplicação" value={domain} onChange={setDomain} hint="Ex: intel.envox.com.br ou 187.127.6.191:8080" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <a href="/docs" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#f8fafc', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', color: '#334155', textDecoration: 'none', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              <i className="fas fa-book" style={{ color: '#2563eb' }}></i> Swagger UI (API Docs)
            </a>
            <a href="/api/v1/health" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#f8fafc', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', color: '#334155', textDecoration: 'none', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              <i className="fas fa-heartbeat" style={{ color: '#22c55e' }}></i> Health Check
            </a>
          </div>
        </Section>

        {/* Thresholds */}
        <Section icon="sliders-h" title="Thresholds de Alerta">
          <div style={{ background: '#f8fafc', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: '12px', fontWeight: 500 }}>Configurados via arquivo .env no servidor:</div>
            {[
              { label: 'Threshold de Risco', key: 'ALERT_RISK_THRESHOLD', value: '65' },
              { label: 'Threshold Crítico', key: 'ALERT_CRITICAL_THRESHOLD', value: '85' },
              { label: 'Threshold Oportunidade', key: 'ALERT_OPPORTUNITY_THRESHOLD', value: '60' },
              { label: 'Follow-up em atraso (horas)', key: 'FOLLOWUP_OVERDUE_HOURS', value: '4' },
              { label: 'SLA padrão (minutos)', key: 'SLA_DEFAULT_MINUTES', value: '60' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-card)' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{item.label}</span>
                <code style={{ fontSize: '13px', color: '#334155', background: 'white', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-card)' }}>{item.key}={item.value}</code>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

Object.assign(window, { GroupsScreen, SummaryScreen, TeamScreen, ApiDocsScreen, ConfigScreen });
