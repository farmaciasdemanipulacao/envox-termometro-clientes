// tc-screens-b.jsx — GroupsScreen, IntelligenceScreen, SummaryScreen, TeamScreen, ApiDocsScreen, ConfigScreen

// ─────────────────────────────────────────────────────────────
// IntelligenceScreen — Alertas, Oportunidades, Churn, Follow-ups
// ─────────────────────────────────────────────────────────────
function IntelligenceScreen({ onSelectGroup }) {
  const [tab, setTab]           = React.useState('all');
  const [items, setItems]       = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [selected, setSelected] = React.useState(null);   // item clicado
  const [context, setContext]   = React.useState(null);   // {conversation, messages}
  const [ctxLoading, setCtxLoading] = React.useState(false);

  const load = (t) => {
    setLoading(true);
    window.apiGet('/intelligence/items?item_type=' + (t || tab) + '&limit=50')
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(tab); }, [tab]);

  const handleSelect = async (item) => {
    setSelected(item);
    setContext(null);
    setCtxLoading(true);
    try {
      const d = await window.apiGet('/intelligence/context/' + item.conversation_id + '?limit=20');
      setContext(d);
    } catch(e) { setContext(null); }
    finally { setCtxLoading(false); }
  };

  const kindMeta = {
    alert:       { label: 'Alerta',      color: '#dc2626', bg: '#fef2f2', icon: 'exclamation-circle' },
    churn:       { label: 'Risco Churn', color: '#ea580c', bg: '#fff7ed', icon: 'user-minus'         },
    opportunity: { label: 'Oportunidade',color: '#16a34a', bg: '#f0fdf4', icon: 'lightbulb'          },
    followup:    { label: 'Follow-up',   color: '#ca8a04', bg: '#fefce8', icon: 'clock'              },
  };

  const tabs = [
    { id: 'all',         label: 'Todos',         icon: 'layer-group' },
    { id: 'alerts',      label: 'Alertas',        icon: 'exclamation-circle' },
    { id: 'churn',       label: 'Risco de Churn', icon: 'user-minus' },
    { id: 'opportunities', label: 'Oportunidades', icon: 'lightbulb' },
    { id: 'followups',   label: 'Follow-ups',     icon: 'clock' },
  ];

  const tabStyle = (id) => ({
    padding: '7px 14px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
    cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '6px',
    background: tab === id ? 'var(--color-brand-600)' : 'white',
    color: tab === id ? 'white' : 'var(--color-text-secondary)',
    border: '1px solid ' + (tab === id ? 'var(--color-brand-600)' : 'var(--color-border-default)'),
    fontWeight: tab === id ? 600 : 400, transition: 'all 0.15s ease',
  });

  const severityColor = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#22c55e' };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Inteligência Operacional" subtitle="Itens acionáveis detectados nos últimos 7 dias" />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Lista de itens */}
        <div style={{ flex: selected ? '0 0 420px' : 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: selected ? '1px solid var(--color-border-card)' : 'none' }}>
          {/* Tabs */}
          <div style={{ padding: '16px 24px 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button key={t.id} style={tabStyle(t.id)} onClick={() => { setTab(t.id); setSelected(null); }}>
                <i className={`fas fa-${t.icon}`} style={{ fontSize: '12px' }}></i>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading
              ? <div style={{ textAlign: 'center', padding: '48px' }}><Spinner size={24} color="#2563eb" /></div>
              : items.length === 0
                ? <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    <i className="fas fa-check-circle" style={{ fontSize: '32px', color: '#22c55e', display: 'block', marginBottom: '12px' }}></i>
                    Nenhum item encontrado para este filtro.
                  </div>
                : items.map(item => {
                    const meta = kindMeta[item.kind] || kindMeta.alert;
                    const isActive = selected?.id === item.id && selected?.kind === item.kind;
                    return (
                      <div key={item.kind + item.id}
                        onClick={() => handleSelect(item)}
                        style={{
                          background: isActive ? '#eff6ff' : 'white',
                          border: '1px solid ' + (isActive ? '#2563eb' : 'var(--color-border-card)'),
                          borderLeft: `4px solid ${item.severity ? severityColor[item.severity] : meta.color}`,
                          borderRadius: 'var(--radius-xl)', padding: '14px 16px',
                          cursor: 'pointer', transition: 'all 0.15s ease',
                          animation: 'fadeInUp 0.25s ease',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'white'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-lg)', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className={`fas fa-${meta.icon}`} style={{ color: meta.color, fontSize: '14px' }}></i>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '9999px', background: meta.bg, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                              {item.severity && <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '9999px', background: severityColor[item.severity] + '20', color: severityColor[item.severity], fontWeight: 600 }}>
                                {{ critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' }[item.severity]}
                              </span>}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                              <span><i className="fas fa-users" style={{ marginRight: '3px' }}></i>{item.conversation_name}</span>
                              {item.sender && <span><i className="fas fa-user" style={{ marginRight: '3px' }}></i>{item.sender}</span>}
                              {item.timestamp && <span><i className="fas fa-clock" style={{ marginRight: '3px' }}></i>{new Date(item.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                          </div>
                          <i className="fas fa-chevron-right" style={{ color: '#94a3b8', fontSize: '12px', flexShrink: 0, marginTop: '8px' }}></i>
                        </div>
                      </div>
                    );
                  })
            }
          </div>
        </div>

        {/* Painel de contexto */}
        {selected && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                  {context?.conversation?.name || selected.conversation_name}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Últimas mensagens do grupo
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onSelectGroup && (
                  <button onClick={() => onSelectGroup({ conversation_id: selected.conversation_id, conversation_name: context?.conversation?.name || selected.conversation_name, temperature_score: 0, open_alerts: 0, followups_pending: 0 })}
                    style={{ background: '#2563eb', border: 'none', borderRadius: 'var(--radius-lg)', padding: '6px 12px', cursor: 'pointer', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fas fa-comments"></i> Ver conversa
                  </button>
                )}
                <button onClick={() => setSelected(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 'var(--radius-lg)', padding: '6px 10px', cursor: 'pointer', color: '#64748b', fontSize: '12px' }}>
                  <i className="fas fa-times"></i> Fechar
                </button>
              </div>
            </div>

            {/* Item selecionado */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border-card)', background: '#f8fafc' }}>
              {(() => {
                const meta = kindMeta[selected.kind] || kindMeta.alert;
                return (
                  <div style={{ background: meta.bg, border: `1px solid ${meta.color}40`, borderRadius: 'var(--radius-lg)', padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: meta.color, marginBottom: '4px' }}>
                      <i className={`fas fa-${meta.icon}`} style={{ marginRight: '6px' }}></i>{selected.title}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{selected.description}</div>
                  </div>
                );
              })()}
            </div>

            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ctxLoading
                ? <div style={{ textAlign: 'center', padding: '32px' }}><Spinner size={20} color="#2563eb" /></div>
                : !context || context.messages.length === 0
                  ? <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Sem mensagens recentes neste grupo.</div>
                  : context.messages.map(msg => {
                      const riskColor = msg.risk_score >= 70 ? '#dc2626' : msg.risk_score >= 40 ? '#ea580c' : null;
                      return (
                        <div key={msg.id} style={{
                          background: msg.is_churn_risk ? '#fff7ed' : msg.is_opportunity ? '#f0fdf4' : 'white',
                          border: '1px solid ' + (msg.is_churn_risk ? '#fed7aa' : msg.is_opportunity ? '#bbf7d0' : 'var(--color-border-card)'),
                          borderRadius: 'var(--radius-lg)', padding: '10px 14px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px' }}>{msg.type_icon}</span>
                            <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{msg.sender}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>
                              {msg.sent_at ? new Date(msg.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {msg.is_churn_risk && <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: 700 }}>⚠ Churn</span>}
                            {msg.is_opportunity && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>💡</span>}
                            {riskColor && <span style={{ fontSize: '11px', color: riskColor, fontWeight: 700 }}>{msg.risk_score}</span>}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                            {msg.content || (msg.message_type !== 'text' ? `[${msg.message_type}]` : '')}
                          </div>
                          {msg.tags && msg.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                              {msg.tags.map(tag => (
                                <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '9999px', background: '#e2e8f0', color: '#475569' }}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GroupsScreen — dados reais da API + edição de nomes
// ─────────────────────────────────────────────────────────────
function GroupsScreen({ onSelectGroup }) {
  const [groups, setGroups]   = React.useState([]);
  const [search, setSearch]   = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [editId, setEditId]   = React.useState(null);
  const [editVal, setEditVal] = React.useState('');
  const [saving, setSaving]   = React.useState(false);

  React.useEffect(() => {
    const loadGroups = () =>
      window.apiGet('/dashboard/groups').then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
    loadGroups();
    const interval = setInterval(loadGroups, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = groups.filter(g => (g.conversation_name || '').toLowerCase().includes(search.toLowerCase()));
  const tempColor = (s) => s >= 80 ? '#16a34a' : s >= 60 ? '#2563eb' : s >= 40 ? '#ca8a04' : s >= 20 ? '#ea580c' : '#dc2626';
  const tempBg    = (s) => s >= 80 ? '#f0fdf4' : s >= 60 ? '#eff6ff' : s >= 40 ? '#fefce8' : s >= 20 ? '#fff7ed' : '#fef2f2';

  const startEdit = (g, e) => {
    e.stopPropagation();
    setEditId(g.conversation_id);
    setEditVal(g.custom_name || g.conversation_name || '');
  };

  const saveEdit = async (g, e) => {
    e && e.stopPropagation();
    setSaving(true);
    try {
      await window.apiPatch('/conversations/' + g.conversation_id, { custom_name: editVal.trim() || null });
      // Atualiza localmente
      setGroups(gs => gs.map(x => x.conversation_id === g.conversation_id
        ? { ...x, custom_name: editVal.trim() || null, conversation_name: editVal.trim() || x.original_name || x.conversation_name }
        : x));
      window.showToast('Nome atualizado!', 'success');
    } catch(e) { window.showToast('Erro ao salvar', 'error'); }
    finally { setSaving(false); setEditId(null); }
  };

  const cancelEdit = (e) => { e && e.stopPropagation(); setEditId(null); };

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
                        <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                          {editId === g.conversation_id
                            ? (
                              <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(g); if (e.key === 'Escape') cancelEdit(); }}
                                  style={{ flex: 1, padding: '4px 8px', border: '1px solid #2563eb', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', outline: 'none' }}
                                />
                                <button onClick={(e) => saveEdit(g, e)} disabled={saving} style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: '11px' }}>
                                  {saving ? <Spinner size={10} /> : <i className="fas fa-check"></i>}
                                </button>
                                <button onClick={cancelEdit} style={{ padding: '4px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: '11px' }}>
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            )
                            : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.conversation_name}</div>
                                <button onClick={(e) => startEdit(g, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 4px', borderRadius: '4px', flexShrink: 0, opacity: 0 }}
                                  className="edit-btn"
                                  onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#2563eb'; }}
                                  onMouseLeave={e => { e.currentTarget.style.opacity = 0; }}
                                  title="Editar nome">
                                  <i className="fas fa-pencil-alt" style={{ fontSize: '11px' }}></i>
                                </button>
                              </div>
                            )
                          }
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>{g.total_messages || 0} msg hoje</div>
                        </div>
                        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: tempColor(g.temperature_score || 0), background: tempBg(g.temperature_score || 0), padding: '4px 10px', borderRadius: 'var(--radius-lg)', flexShrink: 0 }}>
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
          <p style={{ margin: '0 auto', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', maxWidth: '400px' }}>
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
          { method: 'POST', path: '/auth/token',                        desc: 'Autenticação — obtém JWT token',                    auth: false },
          { method: 'GET',  path: '/dashboard/overview',                desc: 'Visão geral com KPIs e termômetro',                  auth: true  },
          { method: 'GET',  path: '/dashboard/groups',                  desc: 'Lista grupos monitorados com métricas',              auth: true  },
          { method: 'GET',  path: '/intelligence/items',                desc: 'Itens acionáveis (alertas, churn, oportunidades)',   auth: true  },
          { method: 'GET',  path: '/intelligence/context/{conv_id}',    desc: 'Últimas mensagens de uma conversa',                  auth: true  },
          { method: 'PATCH',path: '/conversations/{id}',                desc: 'Atualiza nome customizado do grupo',                 auth: true  },
          { method: 'PATCH',path: '/participants/{id}',                 desc: 'Atualiza nome customizado do contato',               auth: true  },
          { method: 'GET',  path: '/alerts',                            desc: 'Lista alertas (filtros: status, severity)',          auth: true  },
          { method: 'PATCH',path: '/alerts/{id}',                       desc: 'Atualiza status do alerta',                         auth: true  },
          { method: 'GET',  path: '/summaries/today',                   desc: 'Resumo executivo do dia atual',                     auth: true  },
          { method: 'POST', path: '/summaries/generate',                desc: 'Força geração de novo resumo',                      auth: true  },
          { method: 'POST', path: '/ingest/message',                    desc: 'Ingere mensagem individual',                        auth: false },
          { method: 'POST', path: '/webhooks/wppconnect',               desc: 'Webhook do WppConnect (uso interno)',                auth: false },
          { method: 'GET',  path: '/health',                            desc: 'Healthcheck da API',                                auth: false },
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

        <Section icon="whatsapp fab" title="Conexão WhatsApp (WPPConnect)">
          <Field label="URL do servidor WPPConnect" value={wppUrl} onChange={setWppUrl} hint="Ex: http://187.127.6.191:21465" />
          <Field label="Token secreto" value={wppSecret} onChange={setWppSecret} type="password" hint="Secret configurado no WPPConnect" />
          <Field label="Nome da sessão" value={wppSession} onChange={setWppSession} hint="Ex: termonitor" />
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: 'var(--text-xs)', color: '#854d0e' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
            Para conectar o WhatsApp, vá em <strong>Conexão WhatsApp</strong> no menu lateral após salvar as configurações.
          </div>
        </Section>

        <Section icon="key" title="API Key para Ingestão">
          <Field label="API Key atual" value={apiKey} onChange={setApiKey} type="password" hint="Configurada no arquivo .env do servidor (API_KEY_SECRET)" />
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: 'var(--text-xs)', color: '#1e40af' }}>
            <i className="fas fa-code" style={{ marginRight: '6px' }}></i>
            Use esta key no header <code>X-API-Key</code> para ingerir mensagens via <code>POST /api/v1/ingest/message</code>
          </div>
        </Section>

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

// ─────────────────────────────────────────────────────────────
// ConversationScreen — Timeline, Perfil e Participantes do grupo
// ─────────────────────────────────────────────────────────────
function ConversationScreen({ group, onBack }) {
  const [tab, setTab]           = React.useState('messages');
  const [groupName, setGroupName] = React.useState(group.conversation_name || '');
  const convId                  = group.conversation_id;

  const tabStyle = (id) => ({
    padding: '10px 20px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)', border: 'none', background: 'none',
    color: tab === id ? 'var(--color-brand-600)' : 'var(--color-text-muted)',
    fontWeight: tab === id ? 700 : 400,
    borderBottom: tab === id ? '2px solid var(--color-brand-600)' : '2px solid transparent',
    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
  });

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 32px', borderBottom: '1px solid var(--color-border-card)', background: 'white', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: '#f1f5f9', border: 'none', borderRadius: 'var(--radius-lg)', padding: '7px 14px', cursor: 'pointer', color: '#374151', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-sans)' }}>
          <i className="fas fa-arrow-left"></i> Grupos
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{groupName}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8' }}>
            {group.open_alerts > 0 && <span style={{ color: '#dc2626', marginRight: '10px' }}><i className="fas fa-bell" style={{ marginRight: '3px' }}></i>{group.open_alerts} alerta{group.open_alerts > 1 ? 's' : ''}</span>}
            {group.followups_pending > 0 && <span style={{ color: '#ca8a04', marginRight: '10px' }}><i className="fas fa-clock" style={{ marginRight: '3px' }}></i>{group.followups_pending} follow-up</span>}
            <span><i className="fas fa-thermometer-half" style={{ marginRight: '3px' }}></i>Termômetro: <strong style={{ color: group.temperature_score >= 60 ? '#16a34a' : group.temperature_score >= 40 ? '#ca8a04' : '#dc2626' }}>{group.temperature_score || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-card)', background: 'white', padding: '0 32px', flexShrink: 0 }}>
        <button style={tabStyle('messages')} onClick={() => setTab('messages')}>
          <i className="fas fa-comments"></i> Conversa
        </button>
        <button style={tabStyle('profile')} onClick={() => setTab('profile')}>
          <i className="fas fa-building"></i> Perfil do Grupo
        </button>
        <button style={tabStyle('participants')} onClick={() => setTab('participants')}>
          <i className="fas fa-users"></i> Participantes
        </button>
      </div>

      {/* Content */}
      {tab === 'messages'     && <ConvMessagesTab convId={convId} group={group} />}
      {tab === 'profile'      && <ConvProfileTab  convId={convId} onNameChange={setGroupName} />}
      {tab === 'participants' && <ConvParticipantsTab convId={convId} />}
    </div>
  );
}

// ── Aba: Conversa ─────────────────────────────────────────────
function ConvMessagesTab({ convId, group }) {
  const [filter, setFilter]    = React.useState('all');
  const [data, setData]        = React.useState(null);
  const [loading, setLoading]  = React.useState(true);
  const [loadingMore, setMore] = React.useState(false);
  const bottomRef              = React.useRef(null);

  const load = async (ft, reset = true) => {
    if (reset) { setLoading(true); setData(null); }
    else setMore(true);
    const offset = reset ? 0 : (data?.messages?.length || 0);
    try {
      const d = await window.apiGet(`/conversations/${convId}/messages?filter_type=${ft}&limit=60&offset=${offset}`);
      if (reset) { setData(d); }
      else { setData(prev => ({ ...prev, messages: [...(d.messages || []), ...(prev?.messages || [])], offset: d.offset })); }
    } catch(e) { window.showToast('Erro ao carregar mensagens', 'error'); }
    finally { setLoading(false); setMore(false); }
  };

  React.useEffect(() => { load(filter); }, [filter, convId]);
  React.useEffect(() => {
    if (!loading && data?.messages?.length && filter === 'all')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [loading]);

  const filters = [
    { id: 'all',         label: 'Todas',     icon: 'comments',           color: '#2563eb' },
    { id: 'followup',    label: 'Follow-up', icon: 'clock',              color: '#ca8a04' },
    { id: 'churn',       label: 'Churn',     icon: 'user-minus',         color: '#ea580c' },
    { id: 'opportunity', label: 'Oportun.',  icon: 'lightbulb',          color: '#16a34a' },
    { id: 'alert',       label: 'c/ Alerta', icon: 'exclamation-circle', color: '#dc2626' },
  ];
  const signalMeta = {
    followup:    { label: 'Follow-up', color: '#ca8a04', bg: '#fefce8', icon: 'clock'     },
    churn:       { label: 'Churn',     color: '#ea580c', bg: '#fff7ed', icon: 'user-minus'},
    opportunity: { label: 'Oport.',    color: '#16a34a', bg: '#f0fdf4', icon: 'lightbulb' },
  };
  const severityColor = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#22c55e' };
  const hasMore = data ? (data.offset + data.limit) < data.total : false;

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 32px', borderBottom: '1px solid var(--color-border-card)', background: '#fafafa', display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px',
            borderRadius: '9999px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', border: 'none',
            background: filter === f.id ? f.color : '#e2e8f0', color: filter === f.id ? 'white' : '#475569',
            fontWeight: filter === f.id ? 600 : 400, transition: 'all 0.15s',
          }}>
            <i className={`fas fa-${f.icon}`} style={{ fontSize: '11px' }}></i>{f.label}
            {data && filter !== f.id && f.id === 'all' && <span style={{ marginLeft: '2px', opacity: 0.7 }}>({data.total})</span>}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 32px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '48px' }}><Spinner size={24} color="#2563eb" /></div>
          : !data || data.messages.length === 0
            ? <div style={{ textAlign: 'center', padding: '64px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                {filter !== 'all' ? 'Nenhuma mensagem com este filtro.' : 'Ainda não há mensagens neste grupo.'}
              </div>
            : <>
                {hasMore && <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <button onClick={() => load(filter, false)} disabled={loadingMore}
                    style={{ padding: '7px 18px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '9999px', cursor: 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}>
                    {loadingMore ? <><Spinner size={12} color="#2563eb" />&nbsp; Carregando...</> : '↑ Carregar anteriores'}
                  </button>
                </div>}
                {(() => {
                  let lastDate = '';
                  return data.messages.map((msg) => {
                    const msgDate = msg.sent_at ? new Date(msg.sent_at).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
                    const showDate = msgDate !== lastDate; if (showDate) lastDate = msgDate;
                    const hasSignal = msg.signals.length > 0 || msg.alerts.length > 0;
                    const bl = msg.signals.includes('churn') ? '#ea580c' : msg.signals.includes('opportunity') ? '#16a34a' : msg.signals.includes('followup') ? '#ca8a04' : msg.alerts.length > 0 ? '#dc2626' : 'transparent';
                    const bg = msg.signals.includes('churn') ? '#fff7ed' : msg.signals.includes('opportunity') ? '#f0fdf4' : msg.signals.includes('followup') ? '#fefce8' : msg.alerts.length > 0 ? '#fef2f2' : 'white';
                    const t = msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && <div style={{ textAlign: 'center', padding: '14px 0 6px', fontSize: 'var(--text-xs)', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                          <span style={{ background: '#f1f5f9', padding: '2px 12px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>{msgDate}</span>
                          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                        </div>}
                        <div style={{ background: bg, border: '1px solid ' + (hasSignal ? bl + '40' : 'var(--color-border-card)'), borderLeft: `3px solid ${bl}`, borderRadius: 'var(--radius-lg)', padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: msg.content ? '5px' : 0 }}>
                            <span style={{ fontSize: '14px' }}>{msg.type_icon}</span>
                            <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{msg.sender}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>{t}</span>
                          </div>
                          {msg.content && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.55, paddingLeft: '22px' }}>{msg.content}</div>}
                          {(msg.signals.length > 0 || msg.alerts.length > 0) && (
                            <div style={{ display: 'flex', gap: '5px', marginTop: '7px', paddingLeft: '22px', flexWrap: 'wrap' }}>
                              {msg.signals.map(sig => { const m = signalMeta[sig]; return <span key={sig} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: m.bg, color: m.color, fontWeight: 600 }}><i className={`fas fa-${m.icon}`} style={{ marginRight: '3px', fontSize: '10px' }}></i>{m.label}</span>; })}
                              {msg.alerts.map(al => <span key={al.id} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: severityColor[al.severity] + '20', color: severityColor[al.severity], fontWeight: 600 }}>{al.title}</span>)}
                              {msg.risk_score >= 50 && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>⚠ {msg.risk_score}</span>}
                            </div>
                          )}
                          {msg.tags?.length > 0 && <div style={{ display: 'flex', gap: '4px', marginTop: '5px', paddingLeft: '22px', flexWrap: 'wrap' }}>{msg.tags.map(tag => <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '9999px', background: '#e2e8f0', color: '#475569' }}>{tag}</span>)}</div>}
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}
                <div ref={bottomRef} />
              </>
        }
      </div>
    </div>
  );
}

// ── Aba: Perfil do Grupo ──────────────────────────────────────
function ConvProfileTab({ convId, onNameChange }) {
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving]   = React.useState(false);
  const [form, setForm]       = React.useState({});

  React.useEffect(() => {
    window.apiGet('/conversations/' + convId + '/profile')
      .then(p => { setProfile(p); setForm({ custom_name: p.custom_name || '', group_type: p.group_type || '', ai_context: p.ai_context || '', website: p.website || '', gpt_brain_url: p.gpt_brain_url || '', contract_scope: p.contract_scope || '', contract_value: p.contract_value || '', contract_start: p.contract_start || '', social: p.social || { instagram: '', linkedin: '', facebook: '' }, documents: p.documents || [] }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [convId]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setSoc = (key, val) => setForm(f => ({ ...f, social: { ...f.social, [key]: val } }));
  const addDoc = () => setForm(f => ({ ...f, documents: [...(f.documents || []), { name: '', url: '' }] }));
  const setDoc = (i, key, val) => setForm(f => { const d = [...f.documents]; d[i] = { ...d[i], [key]: val }; return { ...f, documents: d }; });
  const rmDoc  = (i) => setForm(f => ({ ...f, documents: f.documents.filter((_, j) => j !== i) }));

  const save = async () => {
    setSaving(true);
    try {
      await window.apiPatch('/conversations/' + convId, {
        custom_name: form.custom_name || null,
        group_type: form.group_type || null,
        ai_context: form.ai_context || null,
        website: form.website || null,
        gpt_brain_url: form.gpt_brain_url || null,
        social: Object.fromEntries(Object.entries(form.social || {}).filter(([,v]) => v)),
        documents: (form.documents || []).filter(d => d.name || d.url),
        contract_scope: form.contract_scope || null,
        contract_value: form.contract_value || null,
        contract_start: form.contract_start || null,
      });
      if (form.custom_name) onNameChange(form.custom_name);
      else if (profile?.original_name) onNameChange(profile.original_name);
      window.showToast('Perfil salvo!', 'success');
    } catch(e) { window.showToast('Erro ao salvar', 'error'); }
    finally { setSaving(false); }
  };

  const inp = { width: '100%', padding: '9px 12px', boxSizing: 'border-box', border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' };
  const lbl = { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.05em' };
  const grpTypes = [
    { value: 'client',     label: '🤝 Clientes' },
    { value: 'team',       label: '💼 Time / Equipe' },
    { value: 'friends',    label: '😊 Amigos' },
    { value: 'networking', label: '🌐 Networking' },
    { value: 'supplier',   label: '📦 Fornecedores' },
    { value: 'other',      label: '📁 Outro' },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={24} color="#2563eb" /></div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Identificação */}
      <DsCard>
        <SectionTitle icon="id-card" label="Identificação" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={lbl}>Nome no sistema</label>
            <input value={form.custom_name} onChange={e => set('custom_name', e.target.value)} placeholder={profile?.original_name || 'Nome do grupo'} style={inp} />
            {profile?.original_name && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Nome original no WhatsApp: {profile.original_name}</div>}
          </div>
          <div>
            <label style={lbl}>Tipo do grupo</label>
            <select value={form.group_type} onChange={e => set('group_type', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">Selecione o tipo...</option>
              {grpTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: '16px' }}>
          <label style={lbl}>Contexto para a IA <span style={{ color: '#94a3b8', textTransform: 'none', fontWeight: 400 }}>— ajuda a IA entender o propósito deste grupo</span></label>
          <textarea value={form.ai_context} onChange={e => set('ai_context', e.target.value)} placeholder="Ex: Grupo de suporte ao cliente XYZ, empresa de e-commerce de moda. Clientes geralmente têm dúvidas sobre pedidos, trocas e devoluções..." rows={4}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
        </div>
      </DsCard>

      {/* Links e recursos */}
      <DsCard>
        <SectionTitle icon="link" label="Links e Recursos" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>Site</label>
            <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." style={inp} />
          </div>
          <div>
            <label style={lbl}>Link do Cérebro GPT <span style={{ color: '#94a3b8', textTransform: 'none', fontWeight: 400 }}>— link do ChatGPT customizado do cliente</span></label>
            <input value={form.gpt_brain_url} onChange={e => set('gpt_brain_url', e.target.value)} placeholder="https://chatgpt.com/g/..." style={inp} />
          </div>
          <div>
            <label style={lbl}>Redes sociais</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[['instagram', '📸 Instagram'], ['linkedin', '💼 LinkedIn'], ['facebook', '📘 Facebook']].map(([k, pl]) => (
                <input key={k} value={form.social?.[k] || ''} onChange={e => setSoc(k, e.target.value)} placeholder={pl} style={inp} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={lbl}>Documentos e links úteis</label>
              <button onClick={addDoc} style={{ fontSize: '12px', padding: '4px 10px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}>
                <i className="fas fa-plus"></i> Adicionar
              </button>
            </div>
            {(form.documents || []).map((doc, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input value={doc.name} onChange={e => setDoc(i, 'name', e.target.value)} placeholder="Nome do documento" style={{ ...inp, flex: '0 0 180px' }} />
                <input value={doc.url} onChange={e => setDoc(i, 'url', e.target.value)} placeholder="URL ou link" style={{ ...inp, flex: 1 }} />
                <button onClick={() => rmDoc(i)} style={{ padding: '8px 10px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}>
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      </DsCard>

      {/* Contrato (apenas para clientes) */}
      {(form.group_type === 'client' || form.contract_scope) && (
        <DsCard style={{ borderLeft: '4px solid #2563eb' }}>
          <SectionTitle icon="file-contract" label="Contrato e Escopo" color="#2563eb" />
          <div style={{ background: '#eff6ff', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#1e40af', marginBottom: '16px' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
            O escopo do contrato é usado para detectar automaticamente quando o cliente solicita algo fora do combinado ou quando há promessas não cumpridas.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Valor mensal / do contrato</label>
                <input value={form.contract_value} onChange={e => set('contract_value', e.target.value)} placeholder="R$ 3.000/mês" style={inp} />
              </div>
              <div>
                <label style={lbl}>Início do contrato</label>
                <input type="date" value={form.contract_start} onChange={e => set('contract_start', e.target.value)} style={inp} />
              </div>
            </div>
            <div>
              <label style={lbl}>Escopo contratado <span style={{ color: '#94a3b8', textTransform: 'none', fontWeight: 400 }}>— liste o que está incluído no contrato</span></label>
              <textarea value={form.contract_scope} onChange={e => set('contract_scope', e.target.value)}
                placeholder="Ex: Gestão de Instagram (3 posts/semana) + Stories diários + Relatório mensal. NÃO inclui: criação de site, tráfego pago, atendimento ao cliente..."
                rows={5} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>
        </DsCard>
      )}

      {/* Botão salvar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '8px' }}>
        <button onClick={save} disabled={saving} style={{ padding: '10px 28px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saving ? <><Spinner size={14} />&nbsp; Salvando...</> : <><i className="fas fa-save"></i>&nbsp; Salvar Perfil</>}
        </button>
      </div>
    </div>
  );
}

// ── Aba: Participantes ────────────────────────────────────────
function ConvParticipantsTab({ convId }) {
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [editId, setEditId]   = React.useState(null);
  const [editForm, setEditForm] = React.useState({});
  const [saving, setSaving]   = React.useState(false);

  const load = () => {
    setLoading(true);
    window.apiGet('/conversations/' + convId + '/profile')
      .then(p => setProfile(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  React.useEffect(() => { load(); }, [convId]);

  const startEdit = (p) => {
    setEditId(p.id);
    setEditForm({ custom_name: p.custom_name || '', role: p.role || 'unknown', is_internal: p.is_internal || false });
  };
  const savePart = async (p) => {
    setSaving(true);
    try {
      await window.apiPatch('/participants/' + p.id, {
        custom_name: editForm.custom_name || null,
        role: editForm.role,
        is_internal: editForm.is_internal,
      });
      setProfile(prev => ({
        ...prev,
        participants: prev.participants.map(x => x.id === p.id ? { ...x, custom_name: editForm.custom_name || null, name: editForm.custom_name || x.original_name, role: editForm.role, is_internal: editForm.is_internal } : x),
      }));
      window.showToast('Participante atualizado!', 'success');
      setEditId(null);
    } catch(e) { window.showToast('Erro ao salvar', 'error'); }
    finally { setSaving(false); }
  };

  const roles = [
    { value: 'customer',     label: '🧑‍💼 Cliente' },
    { value: 'collaborator', label: '👨‍💻 Colaborador' },
    { value: 'manager',      label: '👑 Gestor' },
    { value: 'bot',          label: '🤖 Bot' },
    { value: 'unknown',      label: '❓ Desconhecido' },
  ];
  const roleColors = { customer: '#2563eb', collaborator: '#16a34a', manager: '#7c3aed', bot: '#64748b', unknown: '#94a3b8' };
  const roleLabels = { customer: 'Cliente', collaborator: 'Colaborador', manager: 'Gestor', bot: 'Bot', unknown: '—' };
  const inp = { width: '100%', padding: '7px 10px', boxSizing: 'border-box', border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' };

  if (loading) return <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={24} color="#2563eb" /></div>;
  const parts = profile?.participants || [];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{parts.length} participante{parts.length !== 1 ? 's' : ''} identificado{parts.length !== 1 ? 's' : ''}</div>
      </div>

      {parts.length === 0
        ? <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Nenhum participante identificado ainda.</div>
        : parts.map(p => (
          <DsCard key={p.id} style={{ padding: '16px 20px' }}>
            {editId === p.id
              ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Nome customizado</label>
                      <input value={editForm.custom_name} onChange={e => setEditForm(f => ({ ...f, custom_name: e.target.value }))} placeholder={p.original_name} style={inp} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') savePart(p); if (e.key === 'Escape') setEditId(null); }}
                      />
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Original: {p.original_name}</div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Papel</label>
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                        {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      <input type="checkbox" checked={editForm.is_internal} onChange={e => setEditForm(f => ({ ...f, is_internal: e.target.checked }))} />
                      Membro interno (ENVOX)
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => savePart(p)} disabled={saving} style={{ padding: '7px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                      {saving ? <Spinner size={12} /> : 'Salvar'}
                    </button>
                    <button onClick={() => setEditId(null)} style={{ padding: '7px 14px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Cancelar</button>
                  </div>
                </div>
              )
              : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px' }}>
                    {p.is_internal ? '👨‍💻' : p.role === 'customer' ? '🧑‍💼' : '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{p.name}</span>
                      {p.custom_name && <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>(orig: {p.original_name})</span>}
                      <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '9999px', background: (roleColors[p.role] || '#94a3b8') + '20', color: roleColors[p.role] || '#94a3b8', fontWeight: 600 }}>
                        {roleLabels[p.role] || p.role}
                      </span>
                      {p.is_internal && <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '9999px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}>Interno</span>}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span><i className="fas fa-comment" style={{ marginRight: '3px' }}></i>{p.message_count} msg</span>
                      {p.last_seen && <span><i className="fas fa-clock" style={{ marginRight: '3px' }}></i>{new Date(p.last_seen).toLocaleDateString('pt-BR')}</span>}
                      {p.group_count > 1 && (
                        <span style={{ color: '#7c3aed' }}>
                          <i className="fas fa-layer-group" style={{ marginRight: '3px' }}></i>em {p.group_count} grupos
                        </span>
                      )}
                      {p.external_id && <span style={{ fontFamily: 'monospace', opacity: 0.6 }}>{p.external_id.split('@')[0]}</span>}
                    </div>
                  </div>
                  <button onClick={() => startEdit(p)} style={{ padding: '7px 14px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fas fa-pencil-alt"></i> Editar
                  </button>
                </div>
              )
            }
          </DsCard>
        ))
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TagsScreen — Relatório analítico de tags detectadas
// ─────────────────────────────────────────────────────────────
function TagsScreen({ onSelectGroup }) {
  const [days, setDays]             = React.useState(30);
  const [data, setData]             = React.useState(null);
  const [loading, setLoading]       = React.useState(true);
  const [activeTag, setActiveTag]   = React.useState(null);
  const [tagMsgs, setTagMsgs]       = React.useState(null);
  const [msgsLoading, setMsgsLoad]  = React.useState(false);

  const load = (d) => {
    setLoading(true);
    window.apiGet('/analytics/tags?days=' + d)
      .then(r => setData(r))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(days); }, [days]);

  const selectTag = async (tag) => {
    if (activeTag === tag) { setActiveTag(null); setTagMsgs(null); return; }
    setActiveTag(tag);
    setMsgsLoad(true);
    setTagMsgs(null);
    try {
      const r = await window.apiGet('/analytics/tags/' + encodeURIComponent(tag) + '/messages?limit=20&days=' + days);
      setTagMsgs(r);
    } catch(e) { setTagMsgs(null); }
    finally { setMsgsLoad(false); }
  };

  // Metadados visuais por tag
  const tagMeta = {
    reclamacao:          { label: 'Reclamação',          color: '#dc2626', bg: '#fef2f2', icon: 'angry'             },
    risco_churn:         { label: 'Risco de Churn',      color: '#ea580c', bg: '#fff7ed', icon: 'user-minus'        },
    urgencia_critica:    { label: 'Urgência Crítica',    color: '#dc2626', bg: '#fef2f2', icon: 'fire'              },
    urgencia_alta:       { label: 'Urgência Alta',       color: '#f97316', bg: '#fff7ed', icon: 'exclamation-circle'},
    urgencia_media:      { label: 'Urgência Média',      color: '#ca8a04', bg: '#fefce8', icon: 'clock'             },
    promessa_detectada:  { label: 'Promessa Detectada',  color: '#7c3aed', bg: '#f5f3ff', icon: 'handshake'         },
    followup_necessario: { label: 'Follow-up Necessário',color: '#0369a1', bg: '#e0f2fe', icon: 'reply'             },
    oportunidade_comercial:{ label: 'Oportunidade',      color: '#16a34a', bg: '#f0fdf4', icon: 'lightbulb'         },
    atrito_interno:      { label: 'Atrito Interno',      color: '#9333ea', bg: '#fdf4ff', icon: 'bolt'              },
    escalada_emocional:  { label: 'Escalada Emocional',  color: '#dc2626', bg: '#fef2f2', icon: 'fire-alt'          },
  };

  const getMeta = (tag) => tagMeta[tag] || { label: tag, color: '#64748b', bg: '#f1f5f9', icon: 'tag' };

  const maxCount = data?.tags?.length ? Math.max(...data.tags.map(t => t.count)) : 1;

  const dayOptions = [7, 15, 30, 60, 90];

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Relatório de Tags"
        subtitle="Análise quantitativa dos sinais detectados nas conversas"
        actions={
          <div style={{ display: 'flex', gap: '6px' }}>
            {dayOptions.map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', border: 'none',
                background: days === d ? 'var(--color-brand-600)' : '#e2e8f0',
                color: days === d ? 'white' : '#475569',
                fontWeight: days === d ? 600 : 400,
              }}>{d}d</button>
            ))}
          </div>
        }
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Lista de tags com barras */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading
            ? <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={28} color="#2563eb" /></div>
            : !data || data.tags.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '64px 32px' }}>
                  <i className="fas fa-tags" style={{ fontSize: '48px', color: '#cbd5e1', display: 'block', marginBottom: '16px' }}></i>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    Nenhuma tag detectada nos últimos {days} dias.
                  </p>
                </div>
              )
              : <>
                  {/* Resumo */}
                  <DsCard style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{data.total_tagged_occurrences}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>ocorrências de tags</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{data.tags.length}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>tipos de sinal</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{days}d</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>janela de análise</div>
                      </div>
                    </div>
                  </DsCard>

                  {/* Barras por tag */}
                  <DsCard>
                    <SectionTitle icon="chart-bar" label="Frequência por Sinal" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {data.tags.map(t => {
                        const meta = getMeta(t.tag);
                        const pct  = Math.max(4, Math.round((t.count / maxCount) * 100));
                        const isActive = activeTag === t.tag;
                        return (
                          <div key={t.tag}
                            onClick={() => selectTag(t.tag)}
                            style={{ cursor: 'pointer', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid ' + (isActive ? meta.color : 'transparent'), background: isActive ? meta.bg : 'transparent', transition: 'all 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + meta.color + '40', flexShrink: 0 }}>
                                <i className={`fas fa-${meta.icon}`} style={{ color: meta.color, fontSize: '12px' }}></i>
                              </div>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>{meta.label}</span>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: meta.color, minWidth: '32px', textAlign: 'right' }}>{t.count}</span>
                            </div>
                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: pct + '%', background: meta.color, borderRadius: '999px', transition: 'width 0.5s ease' }}></div>
                            </div>
                            {/* Top grupos para esta tag */}
                            {t.groups?.length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                {t.groups.slice(0, 4).map(g => (
                                  <span key={g.conv_id} style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '9999px', background: '#f1f5f9', color: '#475569' }}>
                                    {g.name} ({g.count})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </DsCard>

                  {/* Evolução diária */}
                  {data.daily_series?.length > 1 && (
                    <DsCard>
                      <SectionTitle icon="calendar-alt" label="Evolução Diária (top 4 sinais)" />
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border-card)' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 500 }}>Data</th>
                              {data.tags.slice(0, 4).map(t => {
                                const m = getMeta(t.tag);
                                return (
                                  <th key={t.tag} style={{ padding: '8px 12px', textAlign: 'center', color: m.color, fontWeight: 600 }}>
                                    <i className={`fas fa-${m.icon}`} style={{ marginRight: '4px' }}></i>{m.label}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {data.daily_series.slice(-14).map((row, i) => (
                              <tr key={row.date} style={{ borderBottom: '1px solid var(--color-border-card)', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                  {new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </td>
                                {data.tags.slice(0, 4).map(t => {
                                  const v = row[t.tag] || 0;
                                  const m = getMeta(t.tag);
                                  return (
                                    <td key={t.tag} style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      {v > 0
                                        ? <span style={{ fontWeight: 700, color: m.color, background: m.bg, padding: '2px 8px', borderRadius: '9999px' }}>{v}</span>
                                        : <span style={{ color: '#cbd5e1' }}>—</span>
                                      }
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </DsCard>
                  )}
                </>
          }
        </div>

        {/* Painel lateral: mensagens da tag selecionada */}
        {activeTag && (
          <div style={{ width: '420px', flexShrink: 0, borderLeft: '1px solid var(--color-border-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-card)', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {(() => { const m = getMeta(activeTag); return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fas fa-${m.icon}`} style={{ color: m.color, fontSize: '12px' }}></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{m.label}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>últimos {days} dias</div>
                    </div>
                  </div>
                ); })()}
              </div>
              <button onClick={() => { setActiveTag(null); setTagMsgs(null); }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 'var(--radius-lg)', padding: '6px 10px', cursor: 'pointer', color: '#64748b', fontSize: '12px' }}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {msgsLoading
                ? <div style={{ textAlign: 'center', padding: '32px' }}><Spinner size={20} color="#2563eb" /></div>
                : !tagMsgs || tagMsgs.messages.length === 0
                  ? <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      Nenhuma mensagem encontrada.
                    </div>
                  : tagMsgs.messages.map(msg => {
                      const m = getMeta(activeTag);
                      const timeStr = msg.sent_at ? new Date(msg.sent_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(msg.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                      return (
                        <div key={msg.id} style={{ background: m.bg, border: '1px solid ' + m.color + '30', borderLeft: '3px solid ' + m.color, borderRadius: 'var(--radius-lg)', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px' }}>{msg.type_icon}</span>
                            <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--color-text-primary)' }}>{msg.sender}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>em</span>
                            <button
                              onClick={() => onSelectGroup && onSelectGroup({ conversation_id: msg.conv_id, conversation_name: msg.group_name, temperature_score: 0, open_alerts: 0, followups_pending: 0 })}
                              style={{ fontSize: '11px', color: 'var(--color-brand-600)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>
                              {msg.group_name}
                            </button>
                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{timeStr}</span>
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                            {msg.content || ('[' + msg.message_type + ']')}
                          </div>
                          {msg.tags?.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                              {msg.tags.map(tag => {
                                const tm = getMeta(tag);
                                return (
                                  <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '9999px', background: tm.bg, color: tm.color, fontWeight: 500 }}>{tm.label}</span>
                                );
                              })}
                            </div>
                          )}
                          {msg.risk_score >= 50 && (
                            <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: 600 }}>⚠ risco {msg.risk_score}</div>
                          )}
                        </div>
                      );
                    })
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { IntelligenceScreen, GroupsScreen, ConversationScreen, TagsScreen, SummaryScreen, TeamScreen, ApiDocsScreen, ConfigScreen });
