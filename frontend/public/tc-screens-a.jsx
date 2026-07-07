// tc-screens-a.jsx — LoginScreen, DashboardScreen, AlertsScreen (com API real)
// Componentes DS já expostos por tc-shared.jsx via window — usar var (não const)
var Button    = window.Button;
var KPICard   = window.KPICard;
var AlertItem = window.AlertItem;
var GroupCard = window.GroupCard;

// ─────────────────────────────────────────────────────────────
// LoginScreen — conecta na API real
// ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, company, onCreateAccount }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState('');

  const inputStyle = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    outline: 'none', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)',
    transition: 'border-color 0.15s',
  };

  const handleLogin = async () => {
    if (!username || !password) { setError('Preencha usuário e senha.'); return; }
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || 'Credenciais inválidas');
      }
      const data = await r.json();
      localStorage.setItem('envox_token', data.access_token);
      localStorage.setItem('envox_user', data.username || username);
      localStorage.setItem('envox_plan_name', data.plan_name || '');
      const mhd = data.max_history_days;
      localStorage.setItem('envox_max_history_days', mhd === null || mhd === undefined ? '' : String(mhd));
      localStorage.setItem('envox_max_groups', data.max_groups !== undefined ? String(data.max_groups) : '5');
      onLogin({
        userName: data.username || username,
        isAdmin: data.is_admin,
        userId: data.user_id,
        fullName: data.full_name,
        planName: data.plan_name || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-sidebar)', padding: '16px' }}>
      <div style={{ width: 'min(400px, 100%)', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-2xl)', padding: 'clamp(24px, 6vw, 40px)', boxShadow: 'var(--shadow-modal)', animation: 'fadeInUp 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
          <img src="/atenx_assets/web/atenx-mark-96.png" alt="ATENX" style={{ width: '48px', height: '48px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)' }}>{company}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-brand-600)' }}>by Envox</div>
          </div>
        </div>

        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>Acessar painel</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '0 0 24px 0' }}>Entre com suas credenciais para continuar.</p>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 'var(--text-sm)', color: '#991b1b', marginBottom: '16px' }}>
            <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>{error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Usuário</label>
          <input type="text" value={username} placeholder="admin" style={inputStyle}
            onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Senha</label>
          <input type="password" value={password} placeholder="••••••••" style={inputStyle}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={handleLogin} disabled={loading}>
          {loading ? <><Spinner size={14} />&nbsp; Entrando...</> : <><i className="fas fa-sign-in-alt"></i>&nbsp; Entrar</>}
        </Button>

        {onCreateAccount && (
          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border-input)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Ainda não tem conta? </span>
            <button
              onClick={onCreateAccount}
              style={{ background: 'none', border: 'none', color: 'var(--color-brand-600)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Criar conta grátis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DashboardScreen — dados reais da API
// ─────────────────────────────────────────────────────────────
function DashboardScreen({ onNavigate, onGenerateSummary }) {
  const [overview, setOverview]     = React.useState(null);
  const [alerts, setAlerts]         = React.useState([]);
  const [groups, setGroups]         = React.useState([]);
  const [recentMsgs, setRecentMsgs] = React.useState([]);
  const [isRefreshing, setRefreshing] = React.useState(false);
  const [lastUpdate, setLastUpdate]   = React.useState('');
  const isMobile = useIsMobile();

  const load = async () => {
    setRefreshing(true);
    setLastUpdate('Atualizando...');
    try {
      const [ov, al, gr, rm] = await Promise.all([
        window.apiGet('/dashboard/overview').catch(() => null),
        window.apiGet('/alerts?status=open&limit=3').catch(() => []),
        window.apiGet('/dashboard/groups').catch(() => []),
        window.apiGet('/dashboard/recent-messages?limit=15').catch(() => []),
      ]);
      setOverview(ov);
      setAlerts(Array.isArray(al) ? al : []);
      setGroups(Array.isArray(gr) ? gr.slice(0, 4) : []);
      setRecentMsgs(Array.isArray(rm) ? rm : []);
      setLastUpdate('Atualizado em ' + new Date().toLocaleTimeString('pt-BR'));
    } catch(e) {
      window.showToast('Erro ao carregar dados', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const tempScore = overview?.temperature_score ?? 0;
  const dist = overview?.alerts || { critical:0, high:0, medium:0, low:0, open:0 };
  const kpis = [
    { label: 'Mensagens Hoje',   value: overview?.total_messages_today ?? '-',   colorTheme: 'default' },
    { label: 'Grupos Ativos',    value: overview?.active_conversations ?? '-',    colorTheme: 'default' },
    { label: 'Alertas Abertos',  value: dist.open ?? '-',                         colorTheme: 'alert'   },
    { label: 'Oportunidades',    value: overview?.opportunities_detected ?? '-',  colorTheme: 'success' },
    { label: 'Follow-ups Pend.', value: overview?.followups_pending ?? '-',       colorTheme: 'warning' },
    { label: 'Riscos Churn',     value: overview?.churn_signals ?? '-',           colorTheme: 'orange'  },
  ];

  const severityBorder = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
  const severityLabel  = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' };
  const typeLabels = {
    churn_risk: '⚠️ Churn', risk: '🔴 Risco', opportunity: '💡 Oport.',
    followup_delay: '⏰ Follow-up', sla_breach: '⏱️ SLA', friction: '😤 Atrito',
    complaint: '😠 Reclamação', escalation: '🔥 Escalada',
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Dashboard Executivo"
        subtitle={lastUpdate}
        actions={<>
          <Button variant="secondary" onClick={load} disabled={isRefreshing}>
            {isRefreshing ? <><Spinner size={12} color="var(--color-brand-600)" />&nbsp; Atualizando...</> : <><i className="fas fa-sync-alt"></i>&nbsp; Atualizar</>}
          </Button>
          <Button variant="success" onClick={onGenerateSummary}><i className="fas fa-magic"></i>&nbsp; Gerar Resumo</Button>
        </>}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '32px', display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '32px' }}>

        {/* KPIs */}
        <section style={{ animation: 'fadeInUp 0.4s ease' }}>
          <SectionTitle icon="tachometer-alt" label="Visão Geral do Dia" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(6,1fr)', gap: isMobile ? '10px' : '14px', marginBottom: '24px' }}>
            {kpis.map((k, i) => <KPICard key={i} label={k.label} value={k.value} colorTheme={k.colorTheme} />)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '12px' : '20px' }}>
            <DsCard>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-thermometer-half" style={{ color: 'var(--color-brand-600)' }}></i> Termômetro Operacional
              </div>
              <TemperatureGauge score={tempScore} />
              <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>Saúde geral da operação</p>
            </DsCard>

            <DsCard>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-exclamation-triangle" style={{ color: '#eab308' }}></i> Distribuição de Alertas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[{l:'Crítico',c:'#ef4444',k:'critical'},{l:'Alto',c:'#f97316',k:'high'},{l:'Médio',c:'#eab308',k:'medium'},{l:'Baixo',c:'#22c55e',k:'low'}].map(item => (
                  <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.c, flexShrink: 0 }}></span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{item.l}</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{dist[item.k] || 0}</span>
                  </div>
                ))}
              </div>
            </DsCard>

            <DsCard>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-chart-line" style={{ color: '#22c55e' }}></i> Tendências (vs Ontem)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Volume mensagens', value: overview?.message_volume_trend != null ? (overview.message_volume_trend > 0 ? '📈 +' : '📉 ') + overview.message_volume_trend.toFixed(1) + '%' : '-', positive: overview?.message_volume_trend > 0 },
                  { label: 'Alertas abertos',  value: dist.open || 0, positive: null },
                  { label: 'Follow-ups pend.', value: overview?.followups_pending || 0, positive: (overview?.followups_pending || 0) === 0 },
                  { label: 'Oportunidades',    value: overview?.opportunities_detected || 0, positive: (overview?.opportunities_detected || 0) > 0 },
                ].map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{t.label}</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: t.positive === true ? '#16a34a' : t.positive === false ? '#ca8a04' : 'var(--color-text-primary)' }}>{t.value}</span>
                  </div>
                ))}
              </div>
            </DsCard>
          </div>
        </section>

        {/* Alertas recentes */}
        <section style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <SectionTitle icon="bell" label="Alertas Recentes" />
            <button onClick={() => onNavigate('alerts')} style={{ background: 'none', border: 'none', color: 'var(--color-brand-600)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Ver todos ({dist.open || 0}) →
            </button>
          </div>
          {alerts.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-card)' }}>
                Nenhum alerta aberto. Operação tranquila! ✅
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alerts.map(a => (
                  <div key={a.id} style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', padding: '16px', border: '1px solid var(--color-border-card)', borderLeft: `4px solid ${severityBorder[a.severity] || 'var(--color-text-secondary)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', marginBottom: '4px' }}>{a.title}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{a.description}</div>
                      </div>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: severityBorder[a.severity] + '20', color: severityBorder[a.severity], fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '12px' }}>{severityLabel[a.severity]}</span>
                    </div>
                  </div>
                ))}
              </div>
          }
        </section>

        {/* Grupos */}
        <section style={{ animation: 'fadeInUp 0.4s ease 0.2s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <SectionTitle icon="users" label="Grupos em Monitoramento" />
            <button onClick={() => onNavigate('wpp-groups')} style={{ background: 'none', border: 'none', color: 'var(--color-brand-600)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Ver todos ({groups.length}) →
            </button>
          </div>
          {groups.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-card)' }}>
                Nenhum grupo monitorado ainda. Ingira dados via API.
              </div>
            : <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '14px' }}>
                {groups.map(g => (
                  <DsCard key={g.conversation_id || g.id} style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.conversation_name || g.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '8px' }}>{g.total_messages || 0} msg hoje</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: (g.temperature_score||0) >= 60 ? '#16a34a' : (g.temperature_score||0) >= 40 ? '#ca8a04' : '#dc2626' }}>
                      {g.temperature_score || 0}
                    </div>
                  </DsCard>
                ))}
              </div>
          }
        </section>

        {/* Feed de mensagens recentes */}
        <section style={{ animation: 'fadeInUp 0.4s ease 0.3s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <SectionTitle icon="stream" label="Feed em Tempo Real" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              <i className="fas fa-circle" style={{ color: '#22c55e', fontSize: '8px', marginRight: '5px', animation: 'pulse 2s infinite' }}></i>
              atualiza a cada 30s
            </span>
          </div>
          {recentMsgs.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-card)' }}>
                Aguardando mensagens do WhatsApp...
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recentMsgs.map(m => {
                  const riskColor = m.risk_score >= 70 ? '#dc2626' : m.risk_score >= 40 ? '#ea580c' : 'var(--color-text-secondary)';
                  const sentAt = m.sent_at ? new Date(m.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={m.id} style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', border: '1px solid var(--color-border-card)', display: 'flex', alignItems: 'flex-start', gap: '10px', borderLeft: m.risk_score >= 70 ? '3px solid #dc2626' : m.is_opportunity ? '3px solid #22c55e' : '3px solid transparent' }}>
                      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{m.type_icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{m.sender}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>em</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-brand-600)', fontWeight: 500 }}>{m.group_name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-text-muted)' }}>{sentAt}</span>
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.content || (m.message_type !== 'text' ? `[${m.message_type}]` : '')}
                        </div>
                      </div>
                      {m.risk_score >= 40 && (
                        <span style={{ fontSize: '11px', color: riskColor, fontWeight: 700, flexShrink: 0 }}>⚠ {m.risk_score}</span>
                      )}
                      {m.is_opportunity && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>💡</span>
                      )}
                    </div>
                  );
                })}
              </div>
          }
        </section>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AlertsScreen — dados reais da API
// ─────────────────────────────────────────────────────────────
function AlertsScreen() {
  const [alerts, setAlerts]   = React.useState([]);
  const [filter, setFilter]   = React.useState('all');
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected]     = React.useState(null);  // alerta clicado
  const [context, setContext]       = React.useState(null);  // {conversation, messages}
  const [ctxLoading, setCtxLoading] = React.useState(false);
  const [comment, setComment]       = React.useState('');
  const [saving, setSaving]         = React.useState(false);

  const load = async (sev) => {
    setLoading(true);
    try {
      const params = sev && sev !== 'all' ? `?severity=${sev}&status=open` : '?status=open';
      const data = await window.apiGet('/alerts' + params);
      setAlerts(Array.isArray(data) ? data : []);
    } catch(e) { setAlerts([]); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(filter); }, [filter]);

  const severityBorder = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
  const severityLabel  = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' };
  const typeLabels = {
    churn_risk: '⚠️ Churn', risk: '🔴 Risco', opportunity: '💡 Oport.',
    followup_delay: '⏰ Follow-up', sla_breach: '⏱️ SLA',
    friction: '😤 Atrito', complaint: '😠 Reclamação', escalation: '🔥 Escalada', custom: '📌 Customizado',
  };

  const tabStyle = (id) => ({
    padding: '6px 14px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
    cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '6px',
    background: filter === id ? 'var(--color-brand-600)' : 'var(--color-bg-card)',
    color: filter === id ? 'white' : 'var(--color-text-secondary)',
    border: '1px solid ' + (filter === id ? 'var(--color-brand-600)' : 'var(--color-border-default)'),
    fontWeight: filter === id ? 600 : 400, transition: 'all 0.15s ease',
  });

  const handleSelect = async (alert) => {
    setSelected(alert);
    setComment(alert.resolution_comment || '');
    setContext(null);
    setCtxLoading(true);
    try {
      const d = await window.apiGet('/intelligence/context/' + alert.conversation_id + '?limit=20');
      setContext(d);
    } catch(e) { setContext(null); }
    finally { setCtxLoading(false); }
  };

  const closePanel = () => { setSelected(null); setContext(null); setComment(''); };

  const patchAlert = async (id, payload, successMsg) => {
    setSaving(true);
    try {
      const updated = await window.apiPatch('/alerts/' + id, payload);
      window.showToast(successMsg, 'success');
      setAlerts(list => {
        const next = list.map(a => a.id === id ? updated : a);
        // Alerta resolvido/dismissado some da lista de "abertos"
        return payload.status && payload.status !== 'acknowledged' ? next.filter(a => a.id !== id) : next;
      });
      if (selected && selected.id === id) {
        if (payload.status && payload.status !== 'acknowledged') { closePanel(); }
        else { setSelected(updated); }
      }
    } catch(e) { window.showToast('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleAck = (id) => patchAlert(id, { status: 'acknowledged' }, 'Alerta marcado como visto');
  const handleSaveComment = (id) => patchAlert(id, { comment }, 'Comentário salvo — a IA vai considerar isso em alertas futuros');
  const handleResolve = (id) => patchAlert(id, { status: 'resolved', comment: comment.trim() || undefined }, 'Alerta resolvido!');

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Alertas em Aberto" subtitle={alerts.length + ' alerta(s) pendente(s)'} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Lista de alertas */}
        <div style={{ flex: selected ? '0 0 420px' : 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: selected ? '1px solid var(--color-border-card)' : 'none' }}>
          <div style={{ padding: '16px 24px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['all','critical','high','medium','low'].map(id => (
              <button key={id} style={tabStyle(id)} onClick={() => { setFilter(id); closePanel(); }}>
                {id !== 'all' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: filter === id ? 'rgba(255,255,255,0.8)' : severityBorder[id], flexShrink: 0 }}></span>}
                {id === 'all' ? 'Todos' : severityLabel[id]}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
            {loading
              ? <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}><Spinner size={24} color="var(--color-brand-600)" /></div>
              : alerts.length === 0
                ? <div style={{ textAlign: 'center', padding: '64px 32px' }}>
                    <i className="fas fa-check-circle" style={{ fontSize: '48px', color: '#22c55e', display: 'block', marginBottom: '16px' }}></i>
                    <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: 0 }}>Nenhum alerta aberto. Operação tranquila! ✅</p>
                  </div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px' }}>
                    {alerts.map(a => {
                      const isActive = selected?.id === a.id;
                      return (
                      <div key={a.id} onClick={() => handleSelect(a)}
                        style={{
                          background: isActive ? '#f0fdfa' : 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', padding: '16px 20px',
                          border: '1px solid ' + (isActive ? 'var(--color-brand-600)' : 'var(--color-border-card)'),
                          borderLeft: `4px solid ${severityBorder[a.severity] || 'var(--color-text-secondary)'}`, animation: 'fadeInUp 0.25s ease',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{a.title}</span>
                              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: severityBorder[a.severity] + '20', color: severityBorder[a.severity], fontWeight: 600 }}>{severityLabel[a.severity]}</span>
                              {a.alert_type && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: 'var(--color-bg-page)', color: 'var(--color-text-muted)' }}>{typeLabels[a.alert_type] || a.alert_type}</span>}
                            </div>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 6px 0', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.description}</p>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                              {a.conversation_name && <span><i className="fas fa-users" style={{ marginRight: '4px' }}></i>{a.conversation_name}</span>}
                              <span><i className="fas fa-clock" style={{ marginRight: '4px' }}></i>{new Date(a.triggered_at).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleAck(a.id); }} style={{ padding: '6px 10px', background: '#eff6ff', color: 'var(--color-brand-600)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }} title="Marcar como visto"><i className="fas fa-eye"></i></button>
                        </div>
                      </div>
                    ); })}
                  </div>
            }
          </div>
        </div>

        {/* Painel de contexto + comentário + resolução */}
        {selected && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ padding: '10px 16px', background: 'var(--color-neutral-900)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-on-sidebar)' }}>{context?.conversation?.name || selected.conversation_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-placeholder)' }}>Contexto da conversa</div>
              </div>
              <button onClick={closePanel} style={{ background: 'transparent', border: 'none', borderRadius: '50%', padding: '6px 8px', cursor: 'pointer', color: 'var(--color-text-on-sidebar-muted)', fontSize: '14px' }}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border-card)', background: 'var(--color-bg-page)' }}>
              <div style={{ background: (severityBorder[selected.severity] || 'var(--color-text-secondary)') + '15', border: `1px solid ${(severityBorder[selected.severity] || 'var(--color-text-secondary)')}40`, borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: severityBorder[selected.severity] || 'var(--color-text-muted)' }}>{selected.title}</span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: 'var(--color-bg-card)', color: severityBorder[selected.severity], fontWeight: 600 }}>{severityLabel[selected.severity]}</span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{selected.description}</div>
                {selected.excerpt && <div style={{ marginTop: '6px', background: 'var(--color-bg-card)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>"{selected.excerpt}"</div>}
              </div>
            </div>

            {/* Mensagens da conversa — mesma UI de bolhas do IntelligenceScreen */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#e5ddd5', minHeight: '160px' }}>
              {ctxLoading
                ? <div style={{ textAlign: 'center', padding: '32px' }}><Spinner size={20} color="var(--color-brand-600)" /></div>
                : !context || context.messages.length === 0
                  ? <div style={{ textAlign: 'center', padding: '32px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: '10px', padding: '16px 20px', display: 'inline-block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Sem mensagens recentes neste grupo.</div>
                    </div>
                  : context.messages.map(msg => {
                      const t = msg.sent_at ? new Date(msg.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                      const isMe = msg.is_internal;
                      const isAlertMsg = selected.message_id && msg.id === selected.message_id;
                      const hasBg = msg.is_churn_risk ? '#fff7ed' : msg.is_opportunity ? '#f0fdf4' : null;
                      const bubbleBg = isMe ? (hasBg || '#d9fdd3') : (hasBg || 'white');
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
                          <div style={{ maxWidth: '80%', background: bubbleBg, borderRadius: isMe ? '12px 0 12px 12px' : '0 12px 12px 12px', padding: '6px 10px 8px', boxShadow: isAlertMsg ? '0 0 0 2px #dc2626' : '0 1px 2px rgba(0,0,0,0.1)' }}>
                            {!isMe && <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-600)', marginBottom: '2px' }}>{msg.type_icon} {msg.sender}</div>}
                            {isAlertMsg && <div style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', marginBottom: '2px' }}><i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>Mensagem do alerta</div>}
                            <div style={{ fontSize: '12px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                              {msg.content || (msg.message_type !== 'text' ? `[${msg.message_type}]` : '')}
                            </div>
                            {msg.tags && msg.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {msg.tags.map(tag => (
                                  <span key={tag} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '9999px', background: isMe ? 'rgba(0,0,0,0.08)' : 'var(--color-bg-page)', color: 'var(--color-text-muted)' }}>{tag}</span>
                                ))}
                              </div>
                            )}
                            {msg.risk_score >= 50 && <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '3px', fontWeight: 600 }}>⚠ Risco {msg.risk_score}</div>}
                            <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', textAlign: 'right', marginTop: '3px' }}>{t}</div>
                          </div>
                        </div>
                      );
                    })
              }
            </div>

            {/* Comentário + ações de resolução */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border-card)', background: 'var(--color-bg-card)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                <i className="fas fa-comment-dots" style={{ marginRight: '6px', color: 'var(--color-brand-600)' }}></i>
                Comentário (a IA usa isso para calibrar futuras análises)
              </label>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Ex: falso positivo, o cliente só estava confirmando o pedido..."
                style={{ width: '100%', minHeight: '64px', resize: 'vertical', padding: '10px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button disabled={saving} onClick={() => handleSaveComment(selected.id)}
                  style={{ padding: '8px 14px', background: 'var(--color-bg-page)', color: 'var(--color-text-primary)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: saving ? 'default' : 'pointer', fontSize: '12px', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                  Salvar comentário
                </button>
                <button disabled={saving} onClick={() => handleResolve(selected.id)}
                  style={{ padding: '8px 14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: saving ? 'default' : 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.6 : 1 }}>
                  <i className="fas fa-check"></i> Resolver
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, DashboardScreen, AlertsScreen });
