// tc-admin.jsx — Painel administrativo SaaS

// Catálogo de funcionalidades — deve estar antes de qualquer uso
const FEATURE_CATALOG = [
  { id: 'dashboard',           label: 'Dashboard em tempo real',           icon: 'chart-pie',         category: 'Core' },
  { id: 'alerts',              label: 'Alertas automáticos',               icon: 'bell',              category: 'Core' },
  { id: 'daily_summary',       label: 'Resumos diários',                   icon: 'file-alt',          category: 'Core' },
  { id: 'range_summary',       label: 'Resumos por período',               icon: 'calendar-alt',      category: 'Core' },
  { id: 'tags_report',         label: 'Relatório de Tags',                 icon: 'tags',              category: 'Core' },
  { id: 'pwa',                 label: 'App mobile (PWA)',                  icon: 'mobile-alt',        category: 'Core' },
  { id: 'ai_analysis',         label: 'Análise por IA',                    icon: 'brain',             category: 'IA & Análise' },
  { id: 'participant_profile', label: 'Perfilagem de participantes',       icon: 'user-circle',       category: 'IA & Análise' },
  { id: 'heuristics',          label: 'Motor de heurísticas',              icon: 'bolt',              category: 'IA & Análise' },
  { id: 'sentiment',           label: 'Análise de sentimento',             icon: 'face-smile',        category: 'IA & Análise' },
  { id: 'wpp_monitoring',      label: 'Monitoramento de grupos WhatsApp',  icon: 'comments',          category: 'WhatsApp' },
  { id: 'wpp_send',            label: 'Envio automático no WhatsApp',      icon: 'paper-plane',       category: 'WhatsApp' },
  { id: 'virtual_agent',       label: 'Agente Virtual configurável',       icon: 'robot',             category: 'WhatsApp' },
  { id: 'wpp_history',         label: 'Importação de histórico (3 meses)', icon: 'clock-rotate-left', category: 'WhatsApp' },
  { id: 'email_monitoring',    label: 'Monitoramento de e-mails',          icon: 'envelope',          category: 'Integrações' },
  { id: 'api_access',          label: 'Acesso à API',                      icon: 'code',              category: 'Integrações' },
  { id: 'custom_integration',  label: 'Integrações customizadas',          icon: 'puzzle-piece',      category: 'Integrações' },
  { id: 'push_notifications',  label: 'Notificações push',                 icon: 'bell',              category: 'Integrações' },
  { id: 'email_support',       label: 'Suporte por e-mail',                icon: 'headset',           category: 'Suporte' },
  { id: 'priority_support',    label: 'Suporte prioritário',               icon: 'star',              category: 'Suporte' },
  { id: 'dedicated_manager',   label: 'Gerente de conta dedicado',         icon: 'user-tie',          category: 'Suporte' },
  { id: 'sla_guarantee',       label: 'SLA garantido',                     icon: 'shield-alt',        category: 'Suporte' },
  { id: 'onboarding',          label: 'Onboarding personalizado',          icon: 'graduation-cap',    category: 'Suporte' },
];

const CATALOG_LABELS = new Set(FEATURE_CATALOG.map(f => f.label));

function AdminPanel({ onBack }) {
  const [tab, setTab]       = React.useState('dashboard');
  const [stats, setStats]   = React.useState(null);
  const [users, setUsers]   = React.useState([]);
  const [subs, setSubs]     = React.useState([]);
  const [plans, setPlans]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [pushCampaigns, setPushCampaigns] = React.useState([]);
  const [pushStats, setPushStats]         = React.useState([]);
  const [pushUsers, setPushUsers]         = React.useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [st, us, sb, pl, pc, ps, pu] = await Promise.all([
        window.apiGet('/admin/stats').catch(() => ({})),
        window.apiGet('/users/stats').catch(() => []),
        window.apiGet('/admin/subscriptions').catch(() => []),
        window.apiGet('/admin/plans').catch(() => []),
        window.apiGet('/admin/push/campaigns').catch(() => []),
        window.apiGet('/admin/push/stats').catch(() => []),
        window.apiGet('/admin/push/users').catch(() => []),
      ]);
      setStats(st); setUsers(us); setSubs(sb); setPlans(pl);
      setPushCampaigns(pc); setPushStats(ps); setPushUsers(pu);
    } finally {
      setLoading(false);
    }
  };

  // Recarrega só os dados de push (usado depois de criar campanha, e por polling
  // enquanto alguma campanha ainda está sending/queued)
  const loadPush = async () => {
    const [pc, ps] = await Promise.all([
      window.apiGet('/admin/push/campaigns').catch(() => []),
      window.apiGet('/admin/push/stats').catch(() => []),
    ]);
    setPushCampaigns(pc); setPushStats(ps);
  };

  React.useEffect(() => {
    const hasPending = pushCampaigns.some(c => c.status === 'queued' || c.status === 'sending');
    if (!hasPending) return;
    const iv = setInterval(loadPush, 4000);
    return () => clearInterval(iv);
  }, [pushCampaigns]);

  React.useEffect(() => { load(); }, []);

  const TABS = [
    { id: 'dashboard', label: 'Visão Geral', icon: 'chart-pie' },
    { id: 'users',     label: 'Usuários',    icon: 'users' },
    { id: 'plans',     label: 'Planos',      icon: 'layer-group' },
    { id: 'subs',      label: 'Assinaturas', icon: 'credit-card' },
    { id: 'push',      label: 'Notificações Push', icon: 'bell' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-page)', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ background: 'var(--color-bg-header)', borderBottom: '1px solid var(--color-border-card)', padding: '0 24px', display: 'flex', alignItems: 'center', height: '56px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '6px 10px', marginRight: '8px', fontSize: '16px' }}>
          <i className="fas fa-arrow-left" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <i className="fas fa-shield-halved" style={{ color: 'var(--color-brand-600)', fontSize: '18px' }} />
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '16px' }}>Painel Administrativo</span>
        </div>
        <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '14px', padding: '6px 10px' }}>
          <i className="fas fa-rotate" />
        </button>
      </div>

      {/* Tab bar — overflow-x pra caber em telas estreitas (arrasta/desliza se não couber tudo) */}
      <div style={{ background: 'var(--color-bg-header)', borderBottom: '1px solid var(--color-border-card)', padding: '0 24px', display: 'flex', gap: '2px', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px',
              color: tab === t.id ? 'var(--color-brand-600)' : 'var(--color-text-muted)', fontSize: '13px', fontWeight: tab === t.id ? 600 : 400,
              borderBottom: `2px solid ${tab === t.id ? 'var(--color-brand-600)' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: '7px', transition: 'color 0.15s',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <i className={`fas fa-${t.icon}`} style={{ fontSize: '12px' }} />{t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {loading ? (
          <SectionLoader />
        ) : (
          <>
            {tab === 'dashboard' && <AdminDashboard stats={stats} users={users} subs={subs} />}
            {tab === 'users'     && <AdminUsers users={users} subs={subs} plans={plans} onRefresh={load} />}
            {tab === 'plans'     && <AdminPlans plans={plans} onRefresh={load} />}
            {tab === 'subs'      && <AdminSubscriptions subs={subs} plans={plans} onRefresh={load} />}
            {tab === 'push'      && <AdminPush campaigns={pushCampaigns} statsRows={pushStats} pushUsers={pushUsers} onRefresh={loadPush} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Dashboard overview ────────────────────────────────────────
function AdminDashboard({ stats, users, subs }) {
  const s = stats || {};
  const kpis = [
    { icon: 'users',        label: 'Total de usuários',    value: s.total_users || 0,          color: '#3b82f6' },
    { icon: 'circle-check', label: 'Assinaturas ativas',   value: s.active_subscriptions || 0, color: '#22c55e' },
    { icon: 'flask',        label: 'Em período trial',     value: s.trial_subscriptions || 0,  color: '#f59e0b' },
    { icon: 'circle-xmark', label: 'Canceladas',           value: s.cancelled_subscriptions || 0, color: '#ef4444' },
    { icon: 'layer-group',  label: 'Planos ativos',        value: s.total_active_plans || 0,   color: '#a855f7' },
    { icon: 'dollar-sign',  label: 'MRR simulado',         value: `R$ ${(s.mrr || 0).toFixed(0)}`, color: 'var(--color-brand-600)' },
  ];
  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Visão Geral do Sistema</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginBottom: '32px' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '12px', padding: '18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${k.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fas fa-${k.icon}`} style={{ color: k.color, fontSize: '14px' }} />
              </div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{k.label}</span>
            </div>
            <div style={{ color: 'var(--color-text-primary)', fontSize: '26px', fontWeight: 800 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Recent users */}
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>Usuários recentes</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {users.slice(0, 8).map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--color-border-card)' }}>
              <UserAvatar name={u.full_name || u.username} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 500 }}>{u.full_name || u.username}</div>
                <div style={{ color: 'var(--color-text-placeholder)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {u.is_admin && <span style={{ background: '#7c3aed20', color: '#a855f7', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>ADMIN</span>}
                <ActiveDot active={u.is_active} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────
function AdminUsers({ users, subs, plans, onRefresh }) {
  const [search, setSearch]   = React.useState('');
  const [editUser, setEditUser] = React.useState(null);

  const subMap = Object.fromEntries(subs.map(s => [s.user_id, s]));

  const filtered = users.filter(u =>
    !search ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 700, margin: 0 }}>Usuários ({users.length})</h2>
        <input
          type="text" placeholder="Buscar por nome, email, usuário..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '8px 14px', fontSize: '13px', width: '260px', outline: 'none' }}
        />
      </div>

      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 120px 100px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-card)', color: 'var(--color-text-placeholder)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span>Usuário</span><span>E-mail</span><span>Plano</span><span>Status</span><span>Ação</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-placeholder)', fontSize: '14px' }}>Nenhum usuário encontrado</div>
        ) : filtered.map(u => {
          const sub = subMap[u.id];
          return (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 120px 100px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-card)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <UserAvatar name={u.full_name || u.username} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || u.username}</div>
                  <div style={{ color: 'var(--color-text-placeholder)', fontSize: '12px' }}>@{u.username}</div>
                </div>
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '—'}</div>
              <div>
                {sub ? (
                  <span style={{ background: 'rgba(13,148,136,0.1)', color: 'var(--color-brand-600)', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>
                    {sub.plan_name}
                  </span>
                ) : <span style={{ color: 'var(--color-text-placeholder)', fontSize: '12px' }}>—</span>}
              </div>
              <div>
                <SubStatusBadge status={sub?.status} active={u.is_active} isAdmin={u.is_admin} />
              </div>
              <button
                onClick={() => setEditUser(u)}
                style={{ background: 'rgba(13,148,136,0.1)', border: 'none', color: 'var(--color-brand-600)', cursor: 'pointer', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
              >
                Editar
              </button>
            </div>
          );
        })}
      </div>

      {editUser && (
        <EditUserModal
          user={editUser}
          sub={subMap[editUser.id]}
          plans={plans}
          onClose={() => setEditUser(null)}
          onRefresh={() => { setEditUser(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, sub, plans, onClose, onRefresh }) {
  const [planId, setPlanId]   = React.useState(sub?.plan_id || '');
  const [status, setStatus]   = React.useState(sub?.status || 'active');
  const [notes, setNotes]     = React.useState(sub?.notes || '');
  const [isActive, setActive] = React.useState(user.is_active);
  const [loading, setLoading] = React.useState(false);

  async function save() {
    setLoading(true);
    try {
      if (sub) {
        await window.apiPatch(`/admin/subscriptions/${sub.id}`, { plan_id: planId, status, notes });
      }
      if (isActive !== user.is_active) {
        await window.apiPatch(`/users/${user.id}/toggle-active`, {});
      }
      window.showToast('Usuário atualizado!', 'success');
      onRefresh();
    } catch {
      window.showToast('Erro ao salvar.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '16px', padding: '24px', width: 'min(480px, 95vw)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: 'var(--color-text-primary)', fontSize: '16px', fontWeight: 700, margin: 0 }}>{user.full_name || user.username}</h3>
            <div style={{ color: 'var(--color-text-placeholder)', fontSize: '13px' }}>{user.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sub && (
            <>
              <div>
                <label style={labelStyle}>Plano</label>
                <select value={planId} onChange={e => setPlanId(e.target.value)} style={selectStyle}>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — R$ {p.price_monthly.toFixed(0)}/mês</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status da assinatura</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
                  <option value="active">Ativo</option>
                  <option value="trial">Trial</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="expired">Expirado</option>
                  <option value="pending">Pendente</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Observações internas</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...selectStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" checked={isActive} onChange={e => setActive(e.target.checked)} id="active_toggle" style={{ width: '16px', height: '16px', accentColor: 'var(--color-brand-600)' }} />
            <label htmlFor="active_toggle" style={{ color: 'var(--color-text-secondary)', fontSize: '14px', cursor: 'pointer' }}>Conta ativa</label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
          <button onClick={save} disabled={loading} style={{ flex: 2, padding: '10px', background: 'var(--color-brand-600)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Plans tab ─────────────────────────────────────────────────
function AdminPlans({ plans, onRefresh }) {
  const [editing, setEditing] = React.useState(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 700, margin: 0 }}>Planos ({plans.length})</h2>
        <button
          onClick={() => setCreating(true)}
          style={{ background: 'var(--color-brand-600)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <i className="fas fa-plus" /> Novo plano
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
        {plans.map(plan => {
          const feats = plan.features || [];
          const catalogFeats = feats.filter(l => CATALOG_LABELS.has(l));
          const customFeats  = feats.filter(l => !CATALOG_LABELS.has(l));
          return (
          <div key={plan.id} style={{ background: 'var(--color-bg-card)', border: `1px solid ${plan.is_active ? 'var(--color-border-card)' : 'rgba(220,38,38,0.2)'}`, borderRadius: '12px', padding: '18px', opacity: plan.is_active ? 1 : 0.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '16px' }}>{plan.name}</span>
                  {plan.is_featured && <span style={{ background: 'var(--color-brand-600)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>POPULAR</span>}
                  {!plan.is_active && <span style={{ background: '#dc262620', color: '#dc2626', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>INATIVO</span>}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '2px' }}>/{plan.slug}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '20px' }}>R$ {plan.price_monthly.toFixed(0)}</div>
                <div style={{ color: 'var(--color-text-placeholder)', fontSize: '11px' }}>/mês</div>
              </div>
            </div>
            <div style={{ color: 'var(--color-text-placeholder)', fontSize: '13px', marginBottom: '10px' }}>{plan.description}</div>

            {/* Feature pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
              {catalogFeats.slice(0, 6).map((label, i) => {
                const feat = FEATURE_CATALOG.find(f => f.label === label);
                return (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.15)', color: '#5eead4', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>
                    {feat && <i className={`fas fa-${feat.icon}`} style={{ fontSize: '9px' }} />}
                    {label}
                  </span>
                );
              })}
              {customFeats.map((label, i) => (
                <span key={`c${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', color: '#c084fc', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>
                  <i className="fas fa-sparkles" style={{ fontSize: '9px' }} />
                  {label}
                </span>
              ))}
              {feats.length > 6 && (
                <span style={{ background: 'var(--color-border-card)', color: 'var(--color-text-muted)', fontSize: '11px', padding: '2px 8px', borderRadius: '20px' }}>
                  +{feats.length - 6} mais
                </span>
              )}
              {feats.length === 0 && (
                <span style={{ color: 'var(--color-border-default)', fontSize: '12px', fontStyle: 'italic' }}>Nenhuma funcionalidade configurada</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-placeholder)' }}>
                {plan.max_groups === -1 ? 'Grupos ilimitados' : `Até ${plan.max_groups} grupos`}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-placeholder)' }}>
                {feats.length} funcionalidade{feats.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setEditing(plan)}
              style={{ width: '100%', padding: '8px', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '8px', color: 'var(--color-brand-600)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              <i className="fas fa-pen" style={{ marginRight: '6px' }} />Editar plano
            </button>
          </div>
          );
        })}
      </div>

      {(editing || creating) && (
        <PlanFormModal
          plan={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onRefresh={() => { setEditing(null); setCreating(false); onRefresh(); }}
        />
      )}
    </div>
  );
}


function PlanFormModal({ plan, onClose, onRefresh }) {
  const isNew = !plan;

  // Separa features existentes em: do catálogo (por label) e customizadas
  const existingFeatures = plan?.features || [];
  const initEnabled = new Set(existingFeatures.filter(l => CATALOG_LABELS.has(l)));
  const initCustom  = existingFeatures.filter(l => !CATALOG_LABELS.has(l));

  // max_history_days: null=ilimitado, 0=sem histórico, N=dias. Guardamos como string '' para null.
  const mhdInit = plan?.max_history_days === null || plan?.max_history_days === undefined
    ? (plan ? '' : '90')           // plano existente sem valor → ilimitado; novo plano → 90 dias
    : String(plan.max_history_days);

  const [form, setForm]         = React.useState({
    slug:             plan?.slug          || '',
    name:             plan?.name          || '',
    description:      plan?.description   || '',
    price_monthly:    plan?.price_monthly ?? '',
    max_groups:       plan?.max_groups    ?? 5,
    max_history_days: mhdInit,
    is_active:        plan?.is_active     ?? true,
    is_featured:      plan?.is_featured   ?? false,
    display_order:    plan?.display_order ?? 0,
  });
  const [enabled, setEnabled]   = React.useState(initEnabled);  // Set<label>
  const [custom,  setCustom]    = React.useState(initCustom);   // string[]
  const [newCustom, setNewCustom] = React.useState('');
  const [loading, setLoading]   = React.useState(false);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function toggleFeature(label) {
    setEnabled(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function addCustom() {
    const v = newCustom.trim();
    if (v && !custom.includes(v)) {
      setCustom(c => [...c, v]);
      setNewCustom('');
    }
  }

  function removeCustom(label) {
    setCustom(c => c.filter(x => x !== label));
  }

  async function save() {
    // Ordem: primeiro as features do catálogo (na ordem do catálogo), depois as customizadas
    const catalogFeatures = FEATURE_CATALOG.filter(f => enabled.has(f.label)).map(f => f.label);
    const features = [...catalogFeatures, ...custom];

    setLoading(true);
    try {
      const body = {
        ...form,
        price_monthly:    parseFloat(form.price_monthly),
        max_groups:       parseInt(form.max_groups),
        max_history_days: form.max_history_days === '' ? null : parseInt(form.max_history_days),
        display_order:    parseInt(form.display_order),
        features,
      };
      if (isNew) await window.apiPost('/admin/plans', body);
      else       await window.apiPatch(`/admin/plans/${plan.id}`, body);
      window.showToast(isNew ? 'Plano criado!' : 'Plano atualizado!', 'success');
      onRefresh();
    } catch {
      window.showToast('Erro ao salvar plano.', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Agrupa catálogo por categoria
  const categories = [...new Set(FEATURE_CATALOG.map(f => f.category))];
  const byCategory = categories.reduce((acc, cat) => {
    acc[cat] = FEATURE_CATALOG.filter(f => f.category === cat);
    return acc;
  }, {});

  const enabledCount = enabled.size + custom.length;

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{
        background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)',
        borderRadius: '16px', width: 'min(640px, 96vw)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header fixo */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border-card)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: 'var(--color-text-primary)', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                {isNew ? 'Novo plano' : `Editar: ${plan.name}`}
              </h3>
              <div style={{ color: 'var(--color-text-placeholder)', fontSize: '12px', marginTop: '3px' }}>
                {enabledCount} funcionalidade{enabledCount !== 1 ? 's' : ''} ativa{enabledCount !== 1 ? 's' : ''}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

          {/* ── Configurações básicas ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Nome do plano</label>
              <input value={form.name} onChange={e => sf('name', e.target.value)} style={inpStyle} placeholder="Ex: Pro" />
            </div>
            <div>
              <label style={labelStyle}>Slug</label>
              <input value={form.slug} onChange={e => sf('slug', e.target.value)} style={{ ...inpStyle, opacity: isNew ? 1 : 0.5 }} placeholder="pro" disabled={!isNew} />
            </div>
            <div>
              <label style={labelStyle}>Preço mensal (R$)</label>
              <input type="number" value={form.price_monthly} onChange={e => sf('price_monthly', e.target.value)} style={inpStyle} placeholder="197" />
            </div>
            <div>
              <label style={labelStyle}>Máx. grupos (-1 = ilimitado)</label>
              <input type="number" value={form.max_groups} onChange={e => sf('max_groups', e.target.value)} style={inpStyle} />
            </div>
            <div>
              <label style={labelStyle}>Recuperação de histórico</label>
              <select value={form.max_history_days} onChange={e => sf('max_history_days', e.target.value)}
                style={{ ...inpStyle, cursor: 'pointer' }}>
                <option value="0">Não permitir (apenas novas msgs)</option>
                <option value="90">Últimos 3 meses</option>
                <option value="180">Últimos 6 meses</option>
                <option value="365">Último ano</option>
                <option value="">Ilimitado (todo histórico)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ordem na landing</label>
              <input type="number" value={form.display_order} onChange={e => sf('display_order', e.target.value)} style={inpStyle} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Descrição curta</label>
              <input value={form.description} onChange={e => sf('description', e.target.value)} style={inpStyle} placeholder="Para equipes em crescimento..." />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ToggleSwitch checked={form.is_active} onChange={v => sf('is_active', v)} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Plano ativo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ToggleSwitch checked={form.is_featured} onChange={v => sf('is_featured', v)} color="#f59e0b" />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Destaque "Popular"</span>
            </div>
          </div>

          {/* ── Funcionalidades por categoria ── */}
          <div style={{ borderTop: '1px solid var(--color-border-card)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label style={{ ...labelStyle, margin: 0 }}>Funcionalidades incluídas</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setEnabled(new Set(FEATURE_CATALOG.map(f => f.label)))}
                  style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.2)', color: 'var(--color-brand-600)', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Ativar todas
                </button>
                <button
                  onClick={() => setEnabled(new Set())}
                  style={{ background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Limpar
                </button>
              </div>
            </div>

            {categories.map(cat => (
              <div key={cat} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-placeholder)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-border-card)' }} />
                  {cat}
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-border-card)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {byCategory[cat].map(feat => {
                    const on = enabled.has(feat.label);
                    return (
                      <div
                        key={feat.id}
                        onClick={() => toggleFeature(feat.label)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                          background: on ? 'rgba(13,148,136,0.08)' : 'var(--color-border-card)',
                          border: `1px solid ${on ? 'rgba(13,148,136,0.25)' : 'var(--color-border-card)'}`,
                          transition: 'all 0.12s',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
                          background: on ? 'rgba(13,148,136,0.18)' : 'var(--color-border-card)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.12s',
                        }}>
                          <i className={`fas fa-${feat.icon}`} style={{ fontSize: '13px', color: on ? 'var(--color-brand-600)' : 'var(--color-text-placeholder)' }} />
                        </div>
                        <span style={{ flex: 1, fontSize: '13px', color: on ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: on ? 500 : 400, transition: 'color 0.12s' }}>
                          {feat.label}
                        </span>
                        <ToggleSwitch checked={on} onChange={() => toggleFeature(feat.label)} small />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Custom features */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-placeholder)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-border-card)' }} />
                Funcionalidades customizadas
                <div style={{ flex: 1, height: '1px', background: 'var(--color-border-card)' }} />
              </div>

              {custom.map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderRadius: '10px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)', marginBottom: '6px' }}>
                  <i className="fas fa-sparkles" style={{ color: '#a855f7', fontSize: '12px', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-primary)' }}>{label}</span>
                  <button onClick={() => removeCustom(label)} style={{ background: 'none', border: 'none', color: 'var(--color-text-placeholder)', cursor: 'pointer', fontSize: '14px', padding: '2px', lineHeight: 1 }}>×</button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  value={newCustom}
                  onChange={e => setNewCustom(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustom()}
                  placeholder="Ex: Relatório em PDF mensal..."
                  style={{ ...inpStyle, flex: 1, fontSize: '13px' }}
                />
                <button
                  onClick={addCustom}
                  disabled={!newCustom.trim()}
                  style={{ background: newCustom.trim() ? 'var(--color-brand-600)' : 'var(--color-bg-card)', border: 'none', color: newCustom.trim() ? '#fff' : 'var(--color-text-placeholder)', padding: '0 16px', borderRadius: '8px', cursor: newCustom.trim() ? 'pointer' : 'default', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}
                >
                  + Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer fixo */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border-card)', display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={loading} style={{ flex: 2, padding: '11px', background: loading ? '#064e3b' : 'var(--color-brand-600)', border: 'none', borderRadius: '8px', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? <><Spinner size={14} /> Salvando...</> : <>{isNew ? 'Criar plano' : 'Salvar alterações'} ({enabledCount} funcionalidades)</>}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Toggle Switch component ───────────────────────────────────
function ToggleSwitch({ checked, onChange, small = false, color = 'var(--color-brand-600)' }) {
  const w = small ? 32 : 40;
  const h = small ? 18 : 22;
  const r = h - 4;
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width: w, height: h, borderRadius: h, flexShrink: 0,
        background: checked ? color : 'var(--color-border-default)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute',
        top: '50%', transform: 'translateY(-50%)',
        left: checked ? w - r - 3 : 3,
        width: r, height: r, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.18s cubic-bezier(.4,0,.2,1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

// ── Subscriptions tab ─────────────────────────────────────────
function AdminSubscriptions({ subs, plans, onRefresh }) {
  const [filter, setFilter] = React.useState('');
  const [search, setSearch] = React.useState('');

  const filtered = subs.filter(s =>
    (!filter || s.status === filter) &&
    (!search || (s.username || '').toLowerCase().includes(search.toLowerCase()) || (s.full_name || '').toLowerCase().includes(search.toLowerCase()) || (s.email || '').toLowerCase().includes(search.toLowerCase()))
  );

  const statusCounts = subs.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 700, margin: 0 }}>Assinaturas ({subs.length})</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="Buscar usuário..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '7px 12px', fontSize: '13px', width: '200px', outline: 'none' }}
          />
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-secondary)', padding: '7px 12px', fontSize: '13px', outline: 'none' }}>
            <option value="">Todos os status</option>
            <option value="active">Ativo ({statusCounts.active || 0})</option>
            <option value="trial">Trial ({statusCounts.trial || 0})</option>
            <option value="cancelled">Cancelado ({statusCounts.cancelled || 0})</option>
            <option value="expired">Expirado ({statusCounts.expired || 0})</option>
            <option value="pending">Pendente ({statusCounts.pending || 0})</option>
          </select>
        </div>
      </div>

      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 120px 140px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-card)', color: 'var(--color-text-placeholder)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
          <span>Usuário</span><span>Plano</span><span>Status</span><span>Criado em</span><span>Expira em</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-placeholder)' }}>Nenhuma assinatura encontrada</div>
        ) : filtered.map(s => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 120px 140px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-card)', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 500 }}>{s.full_name || s.username}</div>
              <div style={{ color: 'var(--color-text-placeholder)', fontSize: '12px' }}>{s.email}</div>
            </div>
            <span style={{ background: 'rgba(13,148,136,0.1)', color: 'var(--color-brand-600)', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', display: 'inline-block' }}>
              {s.plan_name}
            </span>
            <SubStatusBadge status={s.status} active={true} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '—'}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('pt-BR') : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notificações Push: compor campanha + progresso + relatório de interatividade ──
function AdminPush({ campaigns, statsRows, pushUsers, onRefresh }) {
  const [subTab, setSubTab] = React.useState('compose'); // compose | campaigns | report
  const [title, setTitle]   = React.useState('');
  const [body, setBody]     = React.useState('');
  const [url, setUrl]       = React.useState('/');
  const [targetType, setTargetType] = React.useState('all'); // all | specific
  const [selectedUserIds, setSelectedUserIds] = React.useState([]);
  const [sending, setSending] = React.useState(false);

  const reachableCount = targetType === 'all'
    ? pushUsers.filter(u => u.device_count > 0).length
    : selectedUserIds.filter(id => (pushUsers.find(u => u.id === id)?.device_count || 0) > 0).length;

  function toggleUser(id) {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      window.showToast && window.showToast('Preencha título e mensagem.', 'warning');
      return;
    }
    if (targetType === 'specific' && selectedUserIds.length === 0) {
      window.showToast && window.showToast('Selecione ao menos um usuário.', 'warning');
      return;
    }
    setSending(true);
    try {
      await window.apiPost('/admin/push/campaigns', {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || '/',
        target_type: targetType,
        user_ids: targetType === 'specific' ? selectedUserIds : undefined,
      });
      window.showToast && window.showToast('Campanha criada! Envio em andamento.', 'success');
      setTitle(''); setBody(''); setUrl('/'); setSelectedUserIds([]); setTargetType('all');
      setSubTab('campaigns');
      onRefresh();
    } catch (e) {
      window.showToast && window.showToast('Erro ao criar campanha.', 'error');
    } finally {
      setSending(false);
    }
  }

  const SUB_TABS = [
    { id: 'compose',   label: 'Nova campanha' },
    { id: 'campaigns', label: `Campanhas (${campaigns.length})` },
    { id: 'report',    label: 'Interatividade por usuário' },
  ];

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Notificações Push</h2>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--color-border-card)' }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px',
              color: subTab === t.id ? 'var(--color-brand-600)' : 'var(--color-text-muted)',
              fontSize: '13px', fontWeight: subTab === t.id ? 600 : 400,
              borderBottom: `2px solid ${subTab === t.id ? 'var(--color-brand-600)' : 'transparent'}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'compose' && (
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '12px', padding: '20px', maxWidth: '560px' }}>
          <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Título</label>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
            placeholder="Ex: Nova funcionalidade disponível"
            style={{ width: '100%', background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '9px 12px', fontSize: '13px', outline: 'none', marginBottom: '14px', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Mensagem</label>
          <textarea
            value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={500}
            placeholder="Texto que vai aparecer na notificação"
            style={{ width: '100%', background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '9px 12px', fontSize: '13px', outline: 'none', marginBottom: '14px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
          />

          <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Link ao tocar na notificação (opcional)</label>
          <input
            type="text" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="/"
            style={{ width: '100%', background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '9px 12px', fontSize: '13px', outline: 'none', marginBottom: '18px', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Destinatários</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => setTargetType('all')}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${targetType === 'all' ? 'var(--color-brand-600)' : 'var(--color-border-card)'}`,
                background: targetType === 'all' ? 'rgba(13,148,136,0.1)' : 'var(--color-bg-page)',
                color: targetType === 'all' ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
              }}
            >
              Todos os usuários
            </button>
            <button
              onClick={() => setTargetType('specific')}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${targetType === 'specific' ? 'var(--color-brand-600)' : 'var(--color-border-card)'}`,
                background: targetType === 'specific' ? 'rgba(13,148,136,0.1)' : 'var(--color-bg-page)',
                color: targetType === 'specific' ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
              }}
            >
              Usuários específicos
            </button>
          </div>

          {targetType === 'specific' && (
            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--color-border-card)', borderRadius: '8px', marginBottom: '14px' }}>
              {pushUsers.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-placeholder)', fontSize: '13px' }}>Nenhum usuário encontrado</div>
              ) : pushUsers.map(u => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderBottom: '1px solid var(--color-border-card)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleUser(u.id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                    <div style={{ color: 'var(--color-text-placeholder)', fontSize: '11px' }}>{u.email || '—'}</div>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                    background: u.device_count > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                    color: u.device_count > 0 ? '#22c55e' : 'var(--color-text-placeholder)',
                  }}>
                    {u.device_count} disp.
                  </span>
                </label>
              ))}
            </div>
          )}

          <div style={{ color: 'var(--color-text-placeholder)', fontSize: '12px', marginBottom: '14px' }}>
            <i className="fas fa-circle-info" style={{ marginRight: '5px' }} />
            {reachableCount} usuário(s) com dispositivo ativo vão receber de fato.
          </div>

          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              background: 'var(--color-brand-600)', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? 'Enviando...' : 'Enviar campanha'}
          </button>
        </div>
      )}

      {subTab === 'campaigns' && (
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 100px 1fr 1fr 90px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-card)', color: 'var(--color-text-placeholder)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Campanha</span><span>Status</span><span>Progresso</span><span>Cliques</span><span>Criada em</span>
          </div>
          {campaigns.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-placeholder)' }}>Nenhuma campanha criada ainda</div>
          ) : campaigns.map(c => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 100px 1fr 1fr 90px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-card)', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                <div style={{ color: 'var(--color-text-placeholder)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</div>
              </div>
              <PushCampaignStatusBadge status={c.status} />
              <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                {c.sent}/{c.total} enviados{c.failed > 0 ? `, ${c.failed} falhas` : ''}
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                {c.clicked} cliques ({c.click_rate}%)
              </div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—'}</span>
            </div>
          ))}
        </div>
      )}

      {subTab === 'report' && (
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 90px 90px 90px 1fr', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-card)', color: 'var(--color-text-placeholder)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Usuário</span><span>Disp.</span><span>Enviados</span><span>Cliques</span><span>Taxa</span><span>Última atividade</span>
          </div>
          {statsRows.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-placeholder)' }}>Nenhum envio de push registrado ainda</div>
          ) : statsRows.map(r => (
            <div key={r.user_id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 90px 90px 90px 1fr', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-card)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <UserAvatar name={r.name} size={26} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ color: 'var(--color-text-placeholder)', fontSize: '11px' }}>{r.email || '—'}</div>
                </div>
              </div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{r.device_count}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{r.sent}{r.failed > 0 ? ` (${r.failed} falhas)` : ''}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{r.clicked}</span>
              <span style={{ color: 'var(--color-brand-600)', fontSize: '13px', fontWeight: 600 }}>{r.click_rate}%</span>
              <span style={{ color: 'var(--color-text-placeholder)', fontSize: '12px' }}>
                {r.last_clicked_at ? `Clicou em ${new Date(r.last_clicked_at).toLocaleString('pt-BR')}` : (r.last_sent_at ? `Recebeu em ${new Date(r.last_sent_at).toLocaleString('pt-BR')}` : '—')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PushCampaignStatusBadge({ status }) {
  const map = {
    queued:    { label: 'Na fila',    bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    sending:   { label: 'Enviando',   bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    completed: { label: 'Concluída',  bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
    failed:    { label: 'Falhou',     bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  };
  const s = map[status] || map.queued;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', display: 'inline-block', width: 'fit-content' }}>
      {s.label}
    </span>
  );
}

// ── Shared helpers ────────────────────────────────────────────
function UserAvatar({ name, size = 32 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['var(--color-brand-600)', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `${color}30`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, fontWeight: 700, fontSize: Math.floor(size * 0.38) + 'px', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function ActiveDot({ active }) {
  return (
    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: active ? '#22c55e' : 'var(--color-text-placeholder)', flexShrink: 0 }} title={active ? 'Ativo' : 'Inativo'} />
  );
}

const STATUS_CONFIG = {
  active:    { label: 'Ativo',     color: '#22c55e', bg: '#22c55e15' },
  trial:     { label: 'Trial',     color: '#f59e0b', bg: '#f59e0b15' },
  cancelled: { label: 'Cancelado', color: '#ef4444', bg: '#ef444415' },
  expired:   { label: 'Expirado',  color: '#6b7280', bg: '#6b728015' },
  pending:   { label: 'Pendente',  color: '#a855f7', bg: '#a855f715' },
};

function SubStatusBadge({ status, active, isAdmin }) {
  if (!active) return <span style={{ background: 'var(--color-text-placeholder)20', color: 'var(--color-text-placeholder)', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>Inativo</span>;
  if (isAdmin) return <span style={{ background: '#7c3aed20', color: '#a855f7', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>Admin</span>;
  if (!status) return <span style={{ color: 'var(--color-text-placeholder)', fontSize: '12px' }}>—</span>;
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'var(--color-text-muted)', bg: 'var(--color-text-muted)15' };
  return <span style={{ background: cfg.bg, color: cfg.color, fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>{cfg.label}</span>;
}

function ModalOverlay({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: '16px' }}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const selectStyle = { width: '100%', padding: '9px 12px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border-card)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '14px', outline: 'none' };
const inpStyle = { ...selectStyle };

Object.assign(window, { AdminPanel });
