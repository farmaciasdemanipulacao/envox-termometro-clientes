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

  // Polling silencioso do painel de contexto aberto (sem spinner, sem
  // resetar seleção) — mantém as últimas mensagens atualizadas.
  React.useEffect(() => {
    if (!selected) return;
    const convId = selected.conversation_id;
    const iv = setInterval(() => {
      window.apiGet('/intelligence/context/' + convId + '?limit=20').then(setContext).catch(() => {});
    }, 6000);
    return () => clearInterval(iv);
  }, [selected?.conversation_id, selected?.kind]);

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
    padding: '5px 12px', borderRadius: '9999px', fontSize: '12px',
    cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '5px',
    background: tab === id ? 'var(--color-brand-600)' : 'var(--color-border-sidebar)',
    color: tab === id ? 'white' : 'var(--color-text-muted)',
    border: 'none',
    fontWeight: tab === id ? 600 : 400, transition: 'all 0.15s ease',
  });

  const severityColor = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#22c55e' };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Inteligência Operacional" subtitle="Itens acionáveis detectados nos últimos 7 dias" />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Lista de itens — estilo WhatsApp */}
        <div style={{ flex: selected ? '0 0 380px' : 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: selected ? '1px solid var(--color-border-sidebar)' : 'none' }}>
          {/* Tabs / Filter bar */}
          <div style={{ padding: '10px 16px', background: 'var(--color-bg-page)', display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border-sidebar)' }}>
            {tabs.map(t => (
              <button key={t.id} style={tabStyle(t.id)} onClick={() => { setTab(t.id); setSelected(null); }}>
                <i className={`fas fa-${t.icon}`} style={{ fontSize: '11px' }}></i>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg-card)' }}>
            {loading
              ? <SectionLoader />
              : items.length === 0
                ? <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-placeholder)', fontSize: 'var(--text-sm)' }}>
                    <i className="fas fa-check-circle" style={{ fontSize: '32px', color: '#22c55e', display: 'block', marginBottom: '12px' }}></i>
                    Nenhum item encontrado para este filtro.
                  </div>
                : items.map(item => {
                    const meta = kindMeta[item.kind] || kindMeta.alert;
                    const isActive = selected?.id === item.id && selected?.kind === item.kind;
                    const ts = item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <div key={item.kind + item.id}
                        onClick={() => handleSelect(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '14px',
                          padding: '12px 20px', cursor: 'pointer',
                          background: isActive ? '#f0fdfa' : 'var(--color-bg-card)',
                          borderBottom: '1px solid var(--color-border-card)',
                          borderLeft: isActive ? '3px solid var(--color-brand-600)' : '3px solid transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg-hover-sidebar)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg-card)'; }}
                      >
                        {/* Avatar círculo */}
                        <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className={`fas fa-${meta.icon}`} style={{ color: 'white', fontSize: '18px' }}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.conversation_name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', flexShrink: 0, marginLeft: '8px' }}>{ts}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                            <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '9999px', background: meta.bg, color: meta.color, fontWeight: 600, flexShrink: 0 }}>{meta.label}</span>
                            {item.severity && <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '9999px', background: severityColor[item.severity] + '20', color: severityColor[item.severity], fontWeight: 600, flexShrink: 0 }}>
                              {{ critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' }[item.severity]}
                            </span>}
                          </div>
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
            {/* Header WhatsApp-style */}
            <div style={{ padding: '10px 16px', background: 'var(--color-neutral-900)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: (kindMeta[selected.kind] || kindMeta.alert).color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fas fa-${(kindMeta[selected.kind] || kindMeta.alert).icon}`} style={{ color: 'white', fontSize: '16px' }}></i>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-on-sidebar)' }}>{context?.conversation?.name || selected.conversation_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-placeholder)' }}>Últimas mensagens</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onSelectGroup && (
                  <button onClick={() => onSelectGroup({ conversation_id: selected.conversation_id, conversation_name: context?.conversation?.name || selected.conversation_name, temperature_score: 0, open_alerts: 0, followups_pending: 0 })}
                    style={{ background: 'var(--color-brand-600)', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fas fa-comments"></i> Abrir
                  </button>
                )}
                <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', borderRadius: '50%', padding: '6px 8px', cursor: 'pointer', color: 'var(--color-text-on-sidebar-muted)', fontSize: '14px' }}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Alert item badge */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border-sidebar)', background: 'var(--color-bg-page)' }}>
              {(() => {
                const meta = kindMeta[selected.kind] || kindMeta.alert;
                return (
                  <div style={{ background: meta.bg, border: `1px solid ${meta.color}40`, borderRadius: '10px', padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: meta.color, marginBottom: '3px' }}>
                      <i className={`fas fa-${meta.icon}`} style={{ marginRight: '6px' }}></i>{selected.title}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{selected.description}</div>
                  </div>
                );
              })()}
            </div>

            {/* Mensagens como bolhas WhatsApp */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#e5ddd5' }}>
              {ctxLoading
                ? <SectionLoader padding="32px" />
                : !context || context.messages.length === 0
                  ? <div style={{ textAlign: 'center', padding: '32px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: '10px', padding: '16px 20px', display: 'inline-block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Sem mensagens recentes neste grupo.</div>
                    </div>
                  : context.messages.map(msg => {
                      const t = msg.sent_at ? new Date(msg.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                      const isMe = msg.is_internal;
                      const hasBg = msg.is_churn_risk ? '#fff7ed' : msg.is_opportunity ? '#f0fdf4' : null;
                      const bubbleBg = isMe ? (hasBg || '#d9fdd3') : (hasBg || 'white');
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
                          <div style={{ maxWidth: '75%', background: bubbleBg, borderRadius: isMe ? '12px 0 12px 12px' : '0 12px 12px 12px', padding: '6px 10px 8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            {!isMe && <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-600)', marginBottom: '2px' }}>{msg.type_icon} {msg.sender}</div>}
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
  const [hovered, setHovered] = React.useState(null);

  React.useEffect(() => {
    const loadGroups = () =>
      window.apiGet('/dashboard/groups').then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
    loadGroups();
    const interval = setInterval(loadGroups, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = groups.filter(g => (g.conversation_name || '').toLowerCase().includes(search.toLowerCase()));
  const tempColor = (s) => s >= 80 ? '#16a34a' : s >= 60 ? 'var(--color-brand-600)' : s >= 40 ? '#ca8a04' : s >= 20 ? '#ea580c' : '#dc2626';
  const avatarColors = ['var(--color-brand-600)', '#0891b2', '#7c3aed', '#be185d', '#d97706', '#15803d', '#b45309', '#0e7490'];
  const avatarColor  = (name, i) => avatarColors[(name || '').charCodeAt(0) % avatarColors.length] || avatarColors[i % avatarColors.length];
  const initials     = (name) => (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

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
      <PageHeader title="Grupos WhatsApp" subtitle={groups.length + ' grupos monitorados'} />

      {/* Search bar WhatsApp-style */}
      <div style={{ padding: '10px 16px', background: 'var(--color-bg-page)', borderBottom: '1px solid var(--color-border-sidebar)' }}>
        <div style={{ position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-placeholder)', fontSize: '13px' }}></i>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', boxSizing: 'border-box', border: 'none', borderRadius: '8px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg-card)' }}>
        {loading
          ? <SectionLoader />
          : filtered.length === 0
            ? <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-placeholder)', fontSize: 'var(--text-sm)' }}>
                {groups.length === 0 ? 'Nenhum grupo monitorado ainda. Ingira dados via API.' : 'Nenhum grupo encontrado.'}
              </div>
            : filtered.map((g, i) => (
                <div key={g.conversation_id}
                  onClick={() => onSelectGroup && onSelectGroup(g)}
                  onMouseEnter={() => setHovered(g.conversation_id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 20px', cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border-card)',
                    background: hovered === g.conversation_id ? 'var(--color-bg-hover-sidebar)' : 'var(--color-bg-card)',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: avatarColor(g.conversation_name, i), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontWeight: 700, fontSize: '17px' }}>
                    {initials(g.conversation_name)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      {editId === g.conversation_id
                        ? (
                          <div style={{ display: 'flex', gap: '6px', flex: 1 }} onClick={e => e.stopPropagation()}>
                            <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(g); if (e.key === 'Escape') cancelEdit(); }}
                              style={{ flex: 1, padding: '3px 8px', border: '1px solid var(--color-brand-600)', borderRadius: '6px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                            <button onClick={e => saveEdit(g, e)} disabled={saving} style={{ padding: '3px 8px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                              {saving ? <Spinner size={10} /> : <i className="fas fa-check"></i>}
                            </button>
                            <button onClick={cancelEdit} style={{ padding: '3px 8px', background: 'var(--color-bg-page)', color: 'var(--color-text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        )
                        : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.conversation_name}</span>
                            <button onClick={e => startEdit(g, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-placeholder)', padding: '2px 3px', borderRadius: '4px', flexShrink: 0, opacity: hovered === g.conversation_id ? 1 : 0, transition: 'opacity 0.1s' }}
                              title="Editar nome">
                              <i className="fas fa-pencil-alt" style={{ fontSize: '11px' }}></i>
                            </button>
                          </div>
                        )
                      }
                      <span style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', flexShrink: 0, marginLeft: '8px' }}>{g.total_messages || 0} msg</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-placeholder)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(g.open_alerts || 0) > 0 ? `🔔 ${g.open_alerts} alerta${g.open_alerts > 1 ? 's' : ''}` : ''}
                        {(g.open_alerts || 0) > 0 && (g.followups_pending || 0) > 0 ? ' · ' : ''}
                        {(g.followups_pending || 0) > 0 ? `⏰ ${g.followups_pending} follow-up` : ''}
                        {(g.open_alerts || 0) === 0 && (g.followups_pending || 0) === 0 ? 'Sem alertas pendentes' : ''}
                      </span>
                      {/* Temperature badge */}
                      <span style={{ fontSize: '12px', fontWeight: 700, color: tempColor(g.temperature_score || 0), flexShrink: 0 }}>
                        {g.temperature_score || 0}°
                      </span>
                      {(g.open_alerts || 0) > 0 && (
                        <span style={{ background: '#25d366', color: 'white', fontSize: '11px', borderRadius: '9999px', minWidth: '18px', height: '18px', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                          {g.open_alerts > 9 ? '9+' : g.open_alerts}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryScreen — Resumo Executivo + Briefing 18h
// ─────────────────────────────────────────────────────────────
function SummaryScreen({ onNavigateAlerts }) {
  const [activeTab, setActiveTab]      = React.useState('resumo');
  const [summary, setSummary]          = React.useState(null);
  const [loading, setLoading]          = React.useState(true);
  const [generating, setGen]           = React.useState(false);
  const [briefing, setBriefing]        = React.useState(null);
  const [loadingBriefing, setLoadingB] = React.useState(false);
  const [genBriefing, setGenBriefing]  = React.useState(false);

  const loadSummary = async () => {
    setLoading(true);
    try { setSummary(await window.apiGet('/summaries/today')); }
    catch(e) { setSummary(null); }
    finally { setLoading(false); }
  };

  const loadBriefing = async () => {
    setLoadingB(true);
    try { setBriefing(await window.apiGet('/briefings/today')); }
    catch(e) { setBriefing(null); }
    finally { setLoadingB(false); }
  };

  React.useEffect(() => { loadSummary(); loadBriefing(); }, []);

  const handleGenerate = async () => {
    setGen(true);
    window.showToast('Gerando resumo executivo...', 'info');
    try {
      await window.apiPost('/summaries/generate');
      window.showToast('Resumo gerado!', 'success');
      loadSummary();
    } catch(e) { window.showToast('Erro: ' + e.message, 'error'); }
    finally { setGen(false); }
  };

  const handleGenBriefing = async () => {
    setGenBriefing(true);
    window.showToast('Gerando briefing de fim de dia...', 'info');
    try {
      const result = await window.apiPost('/briefings/generate');
      setBriefing(result);
      window.showToast('Briefing gerado!', 'success');
    } catch(e) { window.showToast('Erro: ' + e.message, 'error'); }
    finally { setGenBriefing(false); }
  };

  const tempColors = { excellent: '#16a34a', good: 'var(--color-brand-600)', attention: '#ca8a04', warning: '#ea580c', critical: '#dc2626' };

  const renderMd = (text) => (text || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin:10px 0 0">')
    .replace(/\n/g, '<br/>');

  const groupByAssignee = (items) => {
    var map = {};
    (items || []).forEach(function(item) {
      var key = item.assignee || 'Equipe ENVOX';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  };

  const priorityIcon = (p) => p === 'high' ? '🔴' : '🟡';
  const typeLabel    = (t) => t === 'followup' ? 'Follow-up' : t === 'alert' ? 'Alerta' : t === 'churn_risk' ? 'Churn' : t;

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Resumo Executivo"
        subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          activeTab === 'resumo'
            ? <button onClick={handleGenerate} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                {generating ? <><Spinner size={12} />&nbsp; Gerando...</> : <><i className="fas fa-magic"></i>&nbsp; {summary ? 'Regerar Resumo' : 'Gerar Resumo'}</>}
              </button>
            : <button onClick={handleGenBriefing} disabled={genBriefing} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: genBriefing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                {genBriefing ? <><Spinner size={12} />&nbsp; Gerando...</> : <><i className="fas fa-bolt"></i>&nbsp; Gerar Briefing (Teste)</>}
              </button>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-card)', padding: '0 32px', background: 'var(--color-bg-secondary)' }}>
        {[
          { id: 'resumo',   label: 'Resumo do Dia', icon: 'fa-chart-line' },
          { id: 'briefing', label: 'Briefing 18h',  icon: 'fa-tasks' },
        ].map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: active ? 600 : 400, color: active ? 'var(--color-brand-600)' : 'var(--color-text-muted)', borderBottom: active ? '2px solid var(--color-brand-600)' : '2px solid transparent', marginBottom: '-1px', fontFamily: 'var(--font-sans)' }}>
              <i className={'fas ' + tab.icon}></i>
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>

        {/* ── TAB: RESUMO ── */}
        {activeTab === 'resumo' && (
          loading
            ? <SectionLoader padding="64px" />
            : !summary
              ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '16px', animation: 'fadeIn 0.4s ease' }}>
                  <div style={{ width: '72px', height: '72px', background: '#f0fdfa', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-magic" style={{ fontSize: '28px', color: 'var(--color-brand-600)' }}></i>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Resumo ainda não gerado</h3>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '380px' }}>
                    Clique em "Gerar Resumo" para consolidar os dados de hoje em um relatório executivo.
                  </p>
                  <button onClick={handleGenerate} style={{ padding: '10px 24px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    <i className="fas fa-magic" style={{ marginRight: '8px' }}></i>Gerar Resumo do Dia
                  </button>
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeInUp 0.5s ease' }}>
                  <DsCard>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-card)' }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Resumo de {new Date(summary.summary_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Gerado via {summary.generation_method === 'heuristic' ? 'Heurísticas' : 'IA'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '32px', fontWeight: 700, color: tempColors[summary.temperature_label] || 'var(--color-text-primary)' }}>{summary.temperature_score}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Termômetro</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: renderMd(summary.executive_text) }}></div>
                  </DsCard>

                  {summary.highlights?.length > 0 && (
                    <DsCard>
                      <SectionTitle icon="star" label="Destaques do Dia" color="var(--color-brand-600)" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {summary.highlights.map((h, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: '#f0fdfa', borderRadius: 'var(--radius-lg)' }}>
                            <i className="fas fa-check-circle" style={{ color: 'var(--color-brand-600)', marginTop: '2px', flexShrink: 0 }}></i>
                            <span style={{ fontSize: 'var(--text-sm)', color: '#0f766e' }}>{h}</span>
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
        )}

        {/* ── TAB: BRIEFING 18h ── */}
        {activeTab === 'briefing' && (
          loadingBriefing
            ? <SectionLoader padding="64px" />
            : !briefing
              ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '16px', animation: 'fadeIn 0.4s ease' }}>
                  <div style={{ width: '72px', height: '72px', background: '#f5f3ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-tasks" style={{ fontSize: '28px', color: '#7c3aed' }}></i>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Briefing ainda não gerado</h3>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '420px' }}>
                    O briefing de fim de dia é gerado automaticamente às 18h. Use o botão acima para gerar agora (teste).
                  </p>
                  <button onClick={handleGenBriefing} disabled={genBriefing} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: genBriefing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    {genBriefing ? <><Spinner size={12} />&nbsp; Gerando...</> : <><i className="fas fa-bolt"></i>&nbsp; Gerar Briefing Agora</>}
                  </button>
                </div>
              : (() => {
                  const assigneeMap = groupByAssignee(briefing.action_items);
                  const assignees   = Object.keys(assigneeMap);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeInUp 0.5s ease' }}>

                      {/* Cabeçalho */}
                      <DsCard>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-card)' }}>
                          <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                              Briefing de {briefing.summary_date ? new Date(briefing.summary_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'hoje'}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {briefing.generated_at ? 'Gerado às ' + new Date(briefing.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Gerado automaticamente'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '28px', fontWeight: 700, color: tempColors[briefing.temperature_label] || 'var(--color-text-primary)' }}>{briefing.temperature_score}</div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Termômetro</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px 14px', background: '#f5f3ff', borderRadius: 'var(--radius-lg)' }}>
                              <div style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed' }}>{(briefing.action_items || []).length}</div>
                              <div style={{ fontSize: 'var(--text-xs)', color: '#6d28d9' }}>Ações</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: renderMd(briefing.executive_text) }}></div>
                      </DsCard>

                      {/* Distribuição por responsável */}
                      {assignees.length > 0 && (
                        <DsCard>
                          <SectionTitle icon="user-check" label="Distribuição de Responsabilidades" color="#7c3aed" />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                            {assignees.map(assignee => {
                              const items     = assigneeMap[assignee];
                              const highCount = items.filter(i => i.priority === 'high').length;
                              return (
                                <div key={assignee} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-card)', overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f5f3ff', borderBottom: '1px solid #ede9fe' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ color: 'white', fontSize: '11px', fontWeight: 700 }}>{assignee.charAt(0).toUpperCase()}</span>
                                      </div>
                                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: '#4c1d95' }}>{assignee}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      {highCount > 0 && <span style={{ padding: '2px 8px', background: '#fef2f2', color: '#dc2626', borderRadius: '9999px', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{highCount} urgente{highCount > 1 ? 's' : ''}</span>}
                                      <span style={{ padding: '2px 8px', background: '#ede9fe', color: '#6d28d9', borderRadius: '9999px', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{items.length} ação{items.length > 1 ? 'ões' : ''}</span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {items.map((item, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderBottom: idx < items.length - 1 ? '1px solid var(--color-border-card)' : 'none', background: item.priority === 'high' ? '#fffbeb' : 'transparent' }}>
                                        <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{priorityIcon(item.priority)}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.title}</span>
                                            <span style={{ padding: '1px 6px', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', fontSize: '10px', flexShrink: 0 }}>{typeLabel(item.type)}</span>
                                          </div>
                                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                            <i className="fas fa-comments" style={{ marginRight: '4px' }}></i>{item.group}
                                            {item.description && <span style={{ marginLeft: '8px' }}>— {item.description}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </DsCard>
                      )}

                      {/* Tabela de grupos */}
                      {briefing.group_summary?.length > 0 && (
                        <DsCard>
                          <SectionTitle icon="layer-group" label="Panorama dos Grupos" color="#0891b2" />
                          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                              <thead>
                                <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #bae6fd' }}>
                                  {['Grupo', 'Msgs', 'Temp.', 'Alertas', 'Follow-ups', 'Responsável'].map(h => (
                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#0e7490', whiteSpace: 'nowrap' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {briefing.group_summary.map((g, i) => {
                                  const tempColor = g.temperature >= 80 ? '#16a34a' : g.temperature >= 60 ? '#ca8a04' : g.temperature >= 40 ? '#ea580c' : '#dc2626';
                                  return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border-card)', background: i % 2 === 0 ? 'transparent' : '#f9fafb' }}>
                                      <td style={{ padding: '9px 12px', fontWeight: 500 }}>{g.group}</td>
                                      <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{g.messages}</td>
                                      <td style={{ padding: '9px 12px', textAlign: 'center' }}><span style={{ fontWeight: 700, color: tempColor }}>{g.temperature}</span></td>
                                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                        {g.alerts > 0
                                          ? <span style={{ padding: '2px 8px', background: '#fef2f2', color: '#dc2626', borderRadius: '9999px', fontWeight: 600 }}>{g.alerts}</span>
                                          : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                                      </td>
                                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                        {g.followups > 0
                                          ? <span style={{ padding: '2px 8px', background: '#fffbeb', color: '#b45309', borderRadius: '9999px', fontWeight: 600 }}>{g.followups}</span>
                                          : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                                      </td>
                                      <td style={{ padding: '9px 12px', color: 'var(--color-text-secondary)' }}>{g.responsible}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </DsCard>
                      )}

                    </div>
                  );
                })()
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TeamScreen
// ─────────────────────────────────────────────────────────────
function TeamScreen() {
  const [tab, setTab]             = React.useState('members');   // 'members' | 'add'
  const [members, setMembers]     = React.useState([]);
  const [candidates, setCandidates] = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [loadCand, setLoadCand]   = React.useState(false);
  const [search, setSearch]       = React.useState('');
  const [toggling, setToggling]   = React.useState({});
  const [editingId, setEditingId] = React.useState(null);
  const [editName, setEditName]   = React.useState('');

  const loadMembers = () => {
    setLoading(true);
    window.apiGet('/team/members')
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  };

  const loadCandidates = () => {
    setLoadCand(true);
    window.apiGet('/team/candidates')
      .then(d => setCandidates(Array.isArray(d) ? d : []))
      .catch(() => setCandidates([]))
      .finally(() => setLoadCand(false));
  };

  React.useEffect(() => { loadMembers(); }, []);
  React.useEffect(() => { if (tab === 'add') loadCandidates(); }, [tab]);

  const toggleMember = async (p, makeInternal) => {
    setToggling(t => ({ ...t, [p.id]: true }));
    try {
      await window.apiPatch(`/team/members/${p.id}`, {
        is_internal: makeInternal,
        role: makeInternal ? 'collaborator' : 'unknown',
      });
      if (makeInternal) {
        window.showToast(`${p.display_name} adicionado ao time!`, 'success');
        setCandidates(c => c.filter(x => x.id !== p.id));
        loadMembers();
      } else {
        window.showToast(`${p.display_name} removido do time.`, 'info');
        setMembers(m => m.filter(x => x.id !== p.id));
      }
    } catch { window.showToast('Erro ao atualizar colaborador.', 'error'); }
    finally { setToggling(t => ({ ...t, [p.id]: false })); }
  };

  const saveName = async (p) => {
    try {
      await window.apiPatch(`/team/members/${p.id}`, { custom_name: editName });
      setMembers(m => m.map(x => x.id === p.id ? { ...x, display_name: editName || x.name, custom_name: editName || null } : x));
      window.showToast('Nome atualizado!', 'success');
    } catch { window.showToast('Erro ao salvar.', 'error'); }
    finally { setEditingId(null); }
  };

  const fmtMinutes = (m) => {
    if (m === null || m === undefined) return '—';
    if (m < 60) return `${Math.round(m)}min`;
    return `${(m / 60).toFixed(1)}h`;
  };

  const filteredMembers = members.filter(m =>
    !search || m.display_name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCandidates = candidates.filter(c =>
    !search || c.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const tabStyle = (id) => ({
    padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)',
    background: tab === id ? 'var(--color-brand-600)' : 'transparent',
    color: tab === id ? 'white' : 'var(--color-text-muted)',
  });

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Time"
        subtitle={`${members.length} colaborador${members.length !== 1 ? 'es' : ''} cadastrado${members.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => { setTab(tab === 'add' ? 'members' : 'add'); setSearch(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: tab === 'add' ? 'var(--color-border-default)' : 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
            <i className={`fas fa-${tab === 'add' ? 'times' : 'plus'}`}></i>
            {tab === 'add' ? 'Cancelar' : 'Adicionar colaborador'}
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* Tabs + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-page)', borderRadius: '24px', padding: '3px' }}>
            <button style={tabStyle('members')} onClick={() => { setTab('members'); setSearch(''); }}>
              <i className="fas fa-users" style={{ marginRight: '6px', fontSize: '12px' }}></i>Colaboradores ({members.length})
            </button>
            <button style={tabStyle('add')} onClick={() => { setTab('add'); setSearch(''); }}>
              <i className="fas fa-user-plus" style={{ marginRight: '6px', fontSize: '12px' }}></i>Buscar nos grupos
            </button>
          </div>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <i className="fas fa-search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', fontSize: '13px' }}></i>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..."
              style={{ width: '100%', paddingLeft: '32px', padding: '8px 12px 8px 32px', border: '1px solid var(--color-border-card)', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* ── ABA: Colaboradores ── */}
        {tab === 'members' && (
          <>
            {loading
              ? <SectionLoader />
              : filteredMembers.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-secondary)' }}>
                  <i className="fas fa-users" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
                  <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-muted)' }}>
                    {search ? 'Nenhum colaborador encontrado.' : 'Nenhum colaborador cadastrado ainda.'}
                  </div>
                  {!search && <div style={{ fontSize: '13px' }}>Use "Buscar nos grupos" para adicionar colaboradores.</div>}
                </div>
              )
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Header da tabela */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px', gap: '12px', padding: '6px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    <span>Colaborador</span>
                    <span style={{ textAlign: 'center' }}>Grupos</span>
                    <span style={{ textAlign: 'center' }}>Mensagens</span>
                    <span style={{ textAlign: 'center' }}>Resp. média</span>
                    <span></span>
                  </div>
                  {filteredMembers.map(m => (
                    <div key={m.id} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '12px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px', gap: '12px', alignItems: 'center' }}>
                      {/* Nome */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--color-brand-600),#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                          {(m.display_name || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          {editingId === m.id ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveName(m); if (e.key === 'Escape') setEditingId(null); }}
                                style={{ padding: '4px 8px', border: '1px solid var(--color-brand-600)', borderRadius: '6px', fontSize: '13px', outline: 'none', width: '140px' }} />
                              <button onClick={() => saveName(m)} style={{ padding: '4px 8px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓</button>
                              <button onClick={() => setEditingId(null)} style={{ padding: '4px 8px', background: 'var(--color-bg-page)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.display_name}
                                <button onClick={() => { setEditingId(m.id); setEditName(m.custom_name || m.name || ''); }}
                                  style={{ marginLeft: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                                  <i className="fas fa-pen"></i>
                                </button>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.groups?.slice(0, 2).join(', ')}{(m.groups?.length || 0) > 2 ? ` +${m.groups.length - 2}` : ''}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Grupos */}
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>{m.group_count}</span>
                      </div>
                      {/* Mensagens */}
                      <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-text-placeholder)', fontWeight: 500 }}>{m.message_count}</div>
                      {/* Resp. média */}
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: m.avg_response_minutes !== null ? (m.avg_response_minutes <= 30 ? '#16a34a' : m.avg_response_minutes <= 120 ? '#ca8a04' : '#dc2626') : 'var(--color-text-secondary)' }}>
                          {fmtMinutes(m.avg_response_minutes)}
                        </span>
                        {m.response_count > 0 && <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{m.response_count} resp.</div>}
                      </div>
                      {/* Remover */}
                      <div style={{ textAlign: 'center' }}>
                        <button onClick={() => toggleMember(m, false)} disabled={toggling[m.id]}
                          style={{ padding: '5px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                          title="Remover do time">
                          {toggling[m.id] ? <Spinner size={12} color="#dc2626" /> : <i className="fas fa-user-minus"></i>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </>
        )}

        {/* ── ABA: Buscar nos grupos ── */}
        {tab === 'add' && (
          <>
            {loadCand
              ? <SectionLoader />
              : filteredCandidates.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-secondary)' }}>
                  <i className="fas fa-search" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {search ? 'Nenhum participante encontrado.' : 'Nenhum candidato encontrado nos grupos monitorados.'}
                  </div>
                </div>
              )
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    {filteredCandidates.length} participante{filteredCandidates.length !== 1 ? 's' : ''} encontrado{filteredCandidates.length !== 1 ? 's' : ''} nos grupos — clique em "Adicionar ao time" para marcar como colaborador interno.
                  </div>
                  {filteredCandidates.map(c => (
                    <div key={c.id} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                        {(c.display_name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{c.display_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {c.message_count} msgs · {c.groups?.slice(0, 2).join(', ')}{(c.groups?.length || 0) > 2 ? ` +${c.groups.length - 2}` : ''}
                        </div>
                      </div>
                      <button onClick={() => toggleMember(c, true)} disabled={toggling[c.id]}
                        style={{ padding: '6px 12px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {toggling[c.id] ? <Spinner size={12} color="white" /> : <><i className="fas fa-user-plus"></i> Adicionar ao time</>}
                      </button>
                    </div>
                  ))}
                </div>
              )
            }
          </>
        )}
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
        <a href="/docs" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--color-brand-600)', color: 'white', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', textDecoration: 'none', fontWeight: 500 }}>
          <i className="fas fa-external-link-alt"></i> Abrir Swagger UI
        </a>
      } />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DsCard>
          <SectionTitle icon="info-circle" label="Sobre a API" color="var(--color-brand-600)" />
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            A API REST do ATENX permite ingestão de mensagens, consulta de métricas e gerenciamento de alertas.
            Acesse a documentação interativa completa no Swagger UI.
          </p>
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--color-bg-page)', borderRadius: 'var(--radius-lg)', fontFamily: 'monospace', fontSize: '13px', color: 'var(--color-text-primary)' }}>
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
          const mc = { GET: '#ccfbf1', POST: '#dcfce7', PATCH: '#fef9c3', PUT: '#fef9c3', DELETE: '#fee2e2' };
          const tc = { GET: '#0f766e', POST: '#166534', PATCH: '#854d0e', PUT: '#854d0e', DELETE: '#991b1b' };
          return (
            <DsCard key={i} style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: mc[ep.method] || 'var(--color-bg-page)', color: tc[ep.method] || 'var(--color-text-primary)', fontFamily: 'monospace', minWidth: '52px', textAlign: 'center' }}>{ep.method}</span>
                <code style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'monospace', flex: 1 }}>/api/v1{ep.path}</code>
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
function UserFormModal({ onClose, onSaved, editing }) {
  const isEdit = !!editing;
  const [fullName, setFullName] = React.useState(editing?.full_name || '');
  const [username, setUsername] = React.useState(editing?.username || '');
  const [email, setEmail]       = React.useState(editing?.email || '');
  const [password, setPassword] = React.useState('');
  const [isAdmin, setIsAdmin]   = React.useState(editing?.is_admin || false);
  const [saving, setSaving]     = React.useState(false);

  const inputStyle = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none',
    background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
  };
  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' };

  const handleSubmit = async () => {
    if (!isEdit && (!username.trim() || !password.trim())) {
      window.showToast('Username e senha são obrigatórios', 'error'); return;
    }
    if (!isEdit && password.length < 6) {
      window.showToast('Senha deve ter pelo menos 6 caracteres', 'error'); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const body = { full_name: fullName, email: email || null, is_admin: isAdmin };
        if (password) body.password = password;
        await window.apiPatch('/users/' + editing.id, body);
        window.showToast('Usuário atualizado!', 'success');
      } else {
        await window.apiPost('/users', { username: username.trim(), password, full_name: fullName, email: email || null, is_admin: isAdmin });
        window.showToast('Usuário cadastrado!', 'success');
      }
      onSaved();
    } catch (e) {
      window.showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-bg-card)', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
            <i className="fas fa-user-plus" style={{ marginRight: '8px', color: 'var(--color-brand-600)' }}></i>
            {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '18px' }}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Nome completo</label>
            <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex: João Silva" />
          </div>
          {!isEdit && (
            <div>
              <label style={labelStyle}>Username <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="Ex: joao.silva" autoComplete="off" />
            </div>
          )}
          <div>
            <label style={labelStyle}>E-mail</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ex: joao@empresa.com" />
          </div>
          <div>
            <label style={labelStyle}>{isEdit ? 'Nova senha (deixe vazio para manter)' : 'Senha'} {!isEdit && <span style={{ color: '#ef4444' }}>*</span>}</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--color-brand-600)' }} />
            <span>Administrador <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>(acesso total ao sistema)</span></span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'var(--color-bg-page)', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '9px 18px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {saving ? <><Spinner size={12} /> Salvando...</> : <><i className="fas fa-check"></i> {isEdit ? 'Salvar' : 'Cadastrar'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersSection() {
  const [users, setUsers]       = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [modal, setModal]       = React.useState(null); // null | 'new' | user object
  const [toggling, setToggling] = React.useState(null);

  const load = () => {
    setLoading(true);
    window.apiGet('/users')
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => { setLoading(false); window.showToast('Erro ao carregar usuários', 'error'); });
  };

  React.useEffect(load, []);

  const handleToggle = async (user) => {
    setToggling(user.id);
    try {
      await window.apiPatch('/users/' + user.id + '/toggle-active', {});
      load();
    } catch (e) {
      window.showToast(e.message || 'Erro', 'error');
    } finally {
      setToggling(null);
    }
  };

  return (
    <DsCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <SectionTitle icon="users-cog" label="Usuários do Sistema" />
        <button onClick={() => setModal('new')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
          <i className="fas fa-plus"></i> Novo usuário
        </button>
      </div>

      {loading ? (
        <SectionLoader padding="24px" />
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '24px', fontSize: 'var(--text-sm)' }}>Nenhum usuário cadastrado.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: u.is_active ? 'var(--color-bg-page)' : '#fef2f2', border: '1px solid ' + (u.is_active ? 'var(--color-border-card)' : '#fecaca'), borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9999px', background: u.is_active ? '#ccfbf1' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-user" style={{ color: u.is_active ? 'var(--color-brand-600)' : '#ef4444', fontSize: '14px' }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{u.full_name || u.username}</span>
                  {u.full_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>@{u.username}</span>}
                  {u.is_admin && <span style={{ background: '#ede9fe', color: '#7c3aed', fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '9999px' }}>Admin</span>}
                  {!u.is_active && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '9999px' }}>Inativo</span>}
                </div>
                {u.email && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '1px' }}>{u.email}</div>}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => setModal(u)} title="Editar" style={{ padding: '6px 10px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '13px' }}>
                  <i className="fas fa-pen"></i>
                </button>
                <button
                  onClick={() => handleToggle(u)}
                  disabled={toggling === u.id}
                  title={u.is_active ? 'Desativar' : 'Ativar'}
                  style={{ padding: '6px 10px', background: u.is_active ? '#fef2f2' : '#f0fdf4', border: '1px solid ' + (u.is_active ? '#fecaca' : '#bbf7d0'), borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: u.is_active ? '#dc2626' : '#16a34a', fontSize: '13px' }}
                >
                  {toggling === u.id ? <Spinner size={12} /> : <i className={'fas fa-' + (u.is_active ? 'user-slash' : 'user-check')}></i>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <UserFormModal
          editing={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </DsCard>
  );
}

function ConfigScreen() {
  const [wppUrl, setWppUrl]       = React.useState('');
  const [wppSecret, setWppSecret] = React.useState('');
  const [wppSession, setWppSession] = React.useState('');
  const [apiKey, setApiKey]       = React.useState('');
  const [domain, setDomain]       = React.useState(window.location.host);
  const [saving, setSaving]       = React.useState(false);
  const [healthStatus, setHealth] = React.useState(null);

  React.useEffect(() => {
    window.apiGet('/health').then(d => setHealth(d)).catch(() => setHealth({ status: 'error' }));
    // Carrega config do tenant da API
    window.apiGet('/tenant/config').then(cfg => {
      if (cfg.configured) {
        setWppUrl(cfg.wpp_url || '');
        setWppSecret(cfg.wpp_secret || '');
        setWppSession(cfg.wpp_session || '');
      }
    }).catch(() => {});
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await window.apiPut('/tenant/config', { wpp_secret: wppSecret, wpp_url: wppUrl });
      window.showToast('Configurações salvas!', 'success');
    } catch (e) {
      window.showToast('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none',
    background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
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
      {hint && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Configurações" subtitle="Gerencie integrações e parâmetros do sistema"
        actions={
          <button onClick={saveConfig} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
            {saving ? <><Spinner size={12} />&nbsp; Salvando...</> : <><i className="fas fa-save"></i>&nbsp; Salvar</>}
          </button>
        }
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <DsCard style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: (healthStatus?.status === 'ok' || healthStatus?.status === 'healthy') ? '#22c55e' : healthStatus?.status === 'error' ? '#ef4444' : 'var(--color-text-secondary)', flexShrink: 0 }}></div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Status do Backend: {(healthStatus?.status === 'ok' || healthStatus?.status === 'healthy') ? '✅ Online' : healthStatus?.status === 'error' ? '❌ Offline' : '⏳ Verificando...'}
              </div>
              {healthStatus?.version && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Versão {healthStatus.version} · {healthStatus.environment} · DB: {healthStatus.database}</div>}
            </div>
          </div>
        </DsCard>

        <UsersSection />

        <Section icon="whatsapp fab" title="Conexão WhatsApp (WPPConnect)">
          <div>
            <label style={labelStyle}>Sessão (atribuída automaticamente)</label>
            <input type="text" value={wppSession} readOnly style={{ ...inputStyle, background: 'var(--color-bg-page)', color: 'var(--color-text-muted)' }} />
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Identificador único desta conta no WppConnect. Não pode ser alterado.</div>
          </div>
          <Field label="URL do servidor WPPConnect" value={wppUrl} onChange={setWppUrl} hint="Mude apenas se usar um servidor WPPConnect próprio" />
          <Field label="Token secreto" value={wppSecret} onChange={setWppSecret} type="password" hint="Secret configurado no WPPConnect" />
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: 'var(--text-xs)', color: '#854d0e' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
            Para conectar o WhatsApp, vá em <strong>Conexão WhatsApp</strong> no menu lateral após salvar.
          </div>
        </Section>

        <Section icon="key" title="API Key para Ingestão">
          <Field label="API Key atual" value={apiKey} onChange={setApiKey} type="password" hint="Configurada no arquivo .env do servidor (API_KEY_SECRET)" />
          <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: 'var(--text-xs)', color: '#0f766e' }}>
            <i className="fas fa-code" style={{ marginRight: '6px' }}></i>
            Use esta key no header <code>X-API-Key</code> para ingerir mensagens via <code>POST /api/v1/ingest/message</code>
          </div>
        </Section>

        <Section icon="globe" title="Domínio / Acesso">
          <Field label="Domínio da aplicação" value={domain} onChange={setDomain} hint="Ex: intel.envox.com.br ou 187.127.6.191:8080" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <a href="/docs" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-primary)', textDecoration: 'none', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              <i className="fas fa-book" style={{ color: 'var(--color-brand-600)' }}></i> Swagger UI (API Docs)
            </a>
            <a href="/api/v1/health" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-primary)', textDecoration: 'none', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              <i className="fas fa-heartbeat" style={{ color: '#22c55e' }}></i> Health Check
            </a>
          </div>
        </Section>

        <Section icon="sliders-h" title="Thresholds de Alerta">
          <div style={{ background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
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
                <code style={{ fontSize: '13px', color: 'var(--color-text-primary)', background: 'var(--color-bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-card)' }}>{item.key}={item.value}</code>
              </div>
            ))}
          </div>
        </Section>

        <EmailAccountsSection />
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
  const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const tabStyle = (id) => ({
    padding: '12px 20px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)', border: 'none', background: 'none',
    color: tab === id ? 'var(--color-brand-600)' : 'var(--color-text-placeholder)',
    fontWeight: tab === id ? 600 : 400,
    borderBottom: tab === id ? '2px solid var(--color-brand-600)' : '2px solid transparent',
    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
  });

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header WhatsApp-style */}
      <div style={{ padding: '10px 16px', background: 'var(--color-neutral-900)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-on-sidebar-muted)', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fas fa-arrow-left" style={{ fontSize: '16px' }}></i>
        </button>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
          {initials(groupName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-on-sidebar)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-placeholder)' }}>
            {group.open_alerts > 0 && <span style={{ color: '#ef9a9a', marginRight: '8px' }}>{group.open_alerts} alerta{group.open_alerts > 1 ? 's' : ''}</span>}
            {group.followups_pending > 0 && <span style={{ color: '#ffd54f', marginRight: '8px' }}>{group.followups_pending} follow-up</span>}
            <span>Temp: <strong style={{ color: group.temperature_score >= 60 ? '#4caf50' : group.temperature_score >= 40 ? '#ffd54f' : '#ef9a9a' }}>{group.temperature_score || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-card)', background: 'var(--color-bg-card)', padding: '0 16px', flexShrink: 0 }}>
        <button style={tabStyle('messages')} onClick={() => setTab('messages')}>
          <i className="fas fa-comments"></i> Conversa
        </button>
        <button style={tabStyle('profile')} onClick={() => setTab('profile')}>
          <i className="fas fa-building"></i> Perfil
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
  const containerRef           = React.useRef(null);

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

  // Polling silencioso: busca a janela mais recente e só anexa mensagens novas
  // (sem mexer na paginação de "carregar anteriores"), rolando pro fim se o
  // usuário já estava perto do fim.
  React.useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const d = await window.apiGet(`/conversations/${convId}/messages?filter_type=${filter}&limit=60&offset=0`);
        setData(prev => {
          if (!prev) return prev;
          const existingIds = new Set(prev.messages.map(m => m.id));
          const fresh = (d.messages || []).filter(m => !existingIds.has(m.id));
          if (fresh.length === 0) return prev.total === d.total ? prev : { ...prev, total: d.total };
          const el = containerRef.current;
          const nearBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight < 120) : false;
          if (nearBottom) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          return { ...prev, messages: [...prev.messages, ...fresh], total: d.total };
        });
      } catch (_) {}
    }, 6000);
    return () => clearInterval(iv);
  }, [convId, filter]);

  const filters = [
    { id: 'all',         label: 'Todas',     icon: 'comments',           color: 'var(--color-brand-600)' },
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

  const handleSent = (msg) => {
    if (filter === 'all') {
      setData(prev => prev ? { ...prev, messages: [...prev.messages, msg], total: (prev.total || 0) + 1 } : prev);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } else {
      window.showToast('Mensagem enviada!', 'success');
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Filter pills */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border-sidebar)', background: 'var(--color-bg-card)', display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px',
            borderRadius: '9999px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', border: 'none',
            background: filter === f.id ? f.color : 'var(--color-bg-page)', color: filter === f.id ? 'white' : 'var(--color-text-muted)',
            fontWeight: filter === f.id ? 600 : 400, transition: 'all 0.15s',
          }}>
            <i className={`fas fa-${f.icon}`} style={{ fontSize: '11px' }}></i>{f.label}
            {data && f.id === 'all' && <span style={{ marginLeft: '2px', opacity: 0.7 }}>({data.total})</span>}
          </button>
        ))}
      </div>

      {/* Chat area com fundo WhatsApp */}
      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: '2px', background: '#e5ddd5' }}>
        {loading ? <SectionLoader />
          : !data || data.messages.length === 0
            ? <div style={{ textAlign: 'center', padding: '64px' }}>
                <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: '12px', padding: '20px 28px', display: 'inline-block' }}>
                  <i className="fas fa-comments" style={{ fontSize: '32px', color: 'var(--color-text-on-sidebar-muted)', display: 'block', marginBottom: '10px' }}></i>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    {filter !== 'all' ? 'Nenhuma mensagem com este filtro.' : 'Ainda não há mensagens neste grupo.'}
                  </span>
                </div>
              </div>
            : <>
                {hasMore && <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <button onClick={() => load(filter, false)} disabled={loadingMore}
                    style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.85)', color: 'var(--color-brand-600)', border: 'none', borderRadius: '9999px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    {loadingMore ? <><Spinner size={12} color="var(--color-brand-600)" />&nbsp; Carregando...</> : '↑ Carregar anteriores'}
                  </button>
                </div>}
                {(() => {
                  let lastDate = '';
                  return data.messages.map((msg) => {
                    const msgDate = msg.sent_at ? new Date(msg.sent_at).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
                    const showDate = msgDate !== lastDate; if (showDate) lastDate = msgDate;
                    const t = msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                    const isMe = msg.is_internal;
                    const signalBorder = msg.signals.includes('churn') ? '#ea580c' : msg.signals.includes('opportunity') ? '#16a34a' : msg.signals.includes('followup') ? '#ca8a04' : msg.alerts.length > 0 ? '#dc2626' : null;
                    const bubbleBg = isMe
                      ? (signalBorder ? signalBorder + '22' : '#d9fdd3')
                      : (signalBorder ? signalBorder + '18' : 'white');
                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
                            <span style={{ background: 'rgba(255,255,255,0.88)', color: 'var(--color-text-muted)', fontSize: '12px', padding: '4px 12px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>{msgDate}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
                          <div style={{
                            maxWidth: '65%', minWidth: '100px',
                            background: bubbleBg,
                            borderRadius: isMe ? '12px 0 12px 12px' : '0 12px 12px 12px',
                            padding: '6px 10px 8px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                            borderLeft: !isMe && signalBorder ? `3px solid ${signalBorder}` : 'none',
                            borderRight: isMe && signalBorder ? `3px solid ${signalBorder}` : 'none',
                          }}>
                            {!isMe && (
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-brand-600)', marginBottom: '2px' }}>
                                {msg.type_icon} {msg.sender}
                              </div>
                            )}
                            {msg.content && (
                              <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</div>
                            )}
                            {!msg.content && msg.message_type !== 'text' && (
                              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{msg.type_icon} [{msg.message_type}]</div>
                            )}
                            {/* Signals */}
                            {(msg.signals.length > 0 || msg.alerts.length > 0) && (
                              <div style={{ display: 'flex', gap: '4px', marginTop: '5px', flexWrap: 'wrap' }}>
                                {msg.signals.map(sig => { const m = signalMeta[sig]; return <span key={sig} style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '9999px', background: m.bg, color: m.color, fontWeight: 600 }}><i className={`fas fa-${m.icon}`} style={{ marginRight: '2px', fontSize: '9px' }}></i>{m.label}</span>; })}
                                {msg.alerts.map(al => <span key={al.id} style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '9999px', background: severityColor[al.severity] + '20', color: severityColor[al.severity], fontWeight: 600 }}>{al.title}</span>)}
                                {msg.risk_score >= 50 && <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '9999px', background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>⚠ {msg.risk_score}</span>}
                              </div>
                            )}
                            {msg.tags?.length > 0 && (
                              <div style={{ display: 'flex', gap: '3px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {msg.tags.map(tag => <span key={tag} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '9999px', background: isMe ? 'rgba(0,0,0,0.08)' : 'var(--color-bg-page)', color: 'var(--color-text-muted)' }}>{tag}</span>)}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', textAlign: 'right', marginTop: '3px' }}>{t}</div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}
                <div ref={bottomRef} />
              </>
        }
      </div>
      {!loading && data && (
        <MessageComposer convId={convId} wppGroupId={data.conversation?.wpp_group_id} onSent={handleSent} />
      )}
    </div>
  );
}

// ── Caixa de composição estilo WhatsApp (texto / anexo / áudio) ──
function MessageComposer({ convId, wppGroupId, onSent }) {
  const [text, setText]           = React.useState('');
  const [attachment, setAtt]      = React.useState(null); // { base64, mime, name, kind, previewUrl, duration }
  const [sending, setSending]     = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [recSeconds, setRecSeconds] = React.useState(0);
  const [showAssist, setShowAssist]     = React.useState(false);
  const [assistIntent, setAssistIntent] = React.useState('');
  const [assistLoading, setAssistLoading] = React.useState(false);
  const [assistResult, setAssistResult]   = React.useState(null); // { suggestion, why, participant_used, based_on_profile }
  const fileInputRef      = React.useRef(null);
  const textareaRef       = React.useRef(null);
  const mediaRecorderRef  = React.useRef(null);
  const chunksRef         = React.useRef([]);
  const timerRef          = React.useRef(null);

  React.useEffect(() => () => { clearInterval(timerRef.current); }, []);

  const handleTextChange = (e) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleFilePick = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { window.showToast('Arquivo maior que 15MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = String(dataUrl).split(',')[1];
      const kind = file.type.startsWith('image/') ? 'image' : 'document';
      setAtt({ base64, mime: file.type || 'application/octet-stream', name: file.name, kind, previewUrl: kind === 'image' ? dataUrl : null });
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const base64 = String(dataUrl).split(',')[1];
          setAtt({ base64, mime: blob.type || 'audio/webm', name: 'audio.webm', kind: 'audio', previewUrl: dataUrl, duration: recSeconds });
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (e) {
      window.showToast('Não foi possível acessar o microfone', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const canSend = !sending && (text.trim() || attachment);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const msg = await window.apiPost(`/conversations/${convId}/send-message`, {
        text: text.trim(),
        kind: attachment ? attachment.kind : 'text',
        file_base64: attachment ? attachment.base64 : null,
        file_mime: attachment ? attachment.mime : null,
        file_name: attachment ? attachment.name : null,
      });
      onSent(msg);
      setText('');
      setAtt(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (e) {
      window.showToast(e.message || 'Erro ao enviar mensagem', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openAssist = () => { setShowAssist(true); setAssistResult(null); };
  const closeAssist = () => { setShowAssist(false); setAssistResult(null); setAssistIntent(''); };

  const handleAssist = async () => {
    setAssistLoading(true);
    setAssistResult(null);
    try {
      const body = assistIntent.trim()
        ? { intent: assistIntent.trim() }
        : (text.trim() ? { draft: text.trim() } : {});
      const r = await window.apiPost(`/conversations/${convId}/suggest-message`, body);
      setAssistResult(r);
    } catch (e) {
      window.showToast(e.message || 'Erro ao gerar sugestão', 'error');
    } finally {
      setAssistLoading(false);
    }
  };

  const useSuggestion = () => {
    setText(assistResult.suggestion);
    closeAssist();
    setTimeout(() => { if (textareaRef.current) { textareaRef.current.focus(); textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'; } }, 0);
  };

  if (!wppGroupId) {
    return (
      <div style={{ padding: '10px 16px', background: 'var(--color-bg-page)', borderTop: '1px solid var(--color-border-default)', flexShrink: 0, textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-placeholder)' }}>
          <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
          Este grupo não está vinculado a um grupo do WhatsApp — associe o <strong>wpp_group_id</strong> na tela de Seleção de Grupos para enviar mensagens por aqui.
        </span>
      </div>
    );
  }

  return (
    <div style={{ flexShrink: 0, background: 'var(--color-bg-page)', borderTop: '1px solid var(--color-border-default)' }}>
      {showAssist && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-sidebar)', background: 'var(--color-bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              <i className="fas fa-wand-magic-sparkles" style={{ color: 'var(--color-brand-600)', marginRight: '6px' }}></i>
              Sugestão de mensagem com IA
            </span>
            <button onClick={closeAssist} style={{ background: 'none', border: 'none', color: 'var(--color-text-placeholder)', cursor: 'pointer', fontSize: '14px' }}>
              <i className="fas fa-times"></i>
            </button>
          </div>

          {!assistResult && (
            <>
              <textarea
                value={assistIntent}
                onChange={(e) => setAssistIntent(e.target.value)}
                placeholder={text.trim()
                  ? 'O que você quer dizer? Deixe em branco para a IA melhorar o rascunho que você já escreveu.'
                  : 'O que você quer dizer ao cliente? (opcional — deixe em branco para a IA sugerir a melhor continuação da conversa)'}
                rows={2}
                style={{ width: '100%', resize: 'none', border: '1px solid var(--color-border-default)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={handleAssist} disabled={assistLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: assistLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {assistLoading ? <><Spinner size={12} color="white" />&nbsp;Gerando...</> : <><i className="fas fa-sparkles"></i> Gerar sugestão</>}
                </button>
              </div>
            </>
          )}

          {assistResult && (
            <div>
              <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {assistResult.suggestion}
              </div>
              {assistResult.why && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                  <i className="fas fa-lightbulb" style={{ marginRight: '5px' }}></i>{assistResult.why}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', marginTop: '4px' }}>
                {assistResult.participant_used
                  ? (assistResult.based_on_profile
                      ? `Baseado no perfil de IA de ${assistResult.participant_used.name}`
                      : `Sem perfil de IA de ${assistResult.participant_used.name} ainda — sugestão baseada só na conversa`)
                  : 'Sem contato identificado nesta conversa — sugestão baseada só no histórico de mensagens'}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={() => setAssistResult(null)}
                  style={{ padding: '6px 14px', background: 'var(--color-bg-page)', color: 'var(--color-text-muted)', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Tentar de novo
                </button>
                <button onClick={useSuggestion}
                  style={{ padding: '6px 14px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Usar esta mensagem
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {attachment && (
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border-sidebar)', background: 'var(--color-bg-card)' }}>
          {attachment.kind === 'image' && <img src={attachment.previewUrl} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} alt="preview" />}
          {attachment.kind === 'document' && (
            <div style={{ width: 40, height: 40, borderRadius: 6, background: '#eef2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', flexShrink: 0 }}>
              <i className="fas fa-file-alt"></i>
            </div>
          )}
          {attachment.kind === 'audio' && <audio controls src={attachment.previewUrl} style={{ height: 32, maxWidth: '220px' }} />}
          <div style={{ flex: 1, fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {attachment.kind === 'audio' ? `Nota de voz (${attachment.duration || 0}s)` : attachment.name}
          </div>
          <button onClick={() => setAtt(null)} title="Remover anexo"
            style={{ background: 'none', border: 'none', color: 'var(--color-text-placeholder)', cursor: 'pointer', fontSize: '14px' }}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFilePick}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" />
        <button onClick={() => fileInputRef.current?.click()} disabled={recording || sending} title="Anexar arquivo"
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '20px', cursor: recording ? 'not-allowed' : 'pointer', padding: '6px', flexShrink: 0 }}>
          <i className="fas fa-paperclip"></i>
        </button>
        <button onClick={openAssist} disabled={recording || sending} title="Sugerir mensagem com IA"
          style={{ background: 'none', border: 'none', color: showAssist ? 'var(--color-brand-600)' : 'var(--color-text-muted)', fontSize: '20px', cursor: recording ? 'not-allowed' : 'pointer', padding: '6px', flexShrink: 0 }}>
          <i className="fas fa-wand-magic-sparkles"></i>
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={recording || sending}
          placeholder={recording ? 'Gravando áudio...' : 'Digite uma mensagem'}
          rows={1}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none', borderRadius: '20px',
            padding: '9px 14px', fontSize: '14px', fontFamily: 'var(--font-sans)', maxHeight: '120px',
            background: 'var(--color-bg-card)', lineHeight: 1.4,
          }}
        />
        {recording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
            <i className="fas fa-circle" style={{ fontSize: '8px' }}></i>
            {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')}
          </div>
        )}
        {recording ? (
          <button onClick={stopRecording} title="Parar gravação"
            style={{ background: '#dc2626', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0 }}>
            <i className="fas fa-stop"></i>
          </button>
        ) : canSend ? (
          <button onClick={handleSend} disabled={sending} title="Enviar"
            style={{ background: '#25d366', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: sending ? 'not-allowed' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sending ? <Spinner size={14} color="white" /> : <i className="fas fa-paper-plane"></i>}
          </button>
        ) : (
          <button onClick={startRecording} title="Gravar áudio"
            style={{ background: '#25d366', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0 }}>
            <i className="fas fa-microphone"></i>
          </button>
        )}
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

  const inp = { width: '100%', padding: '9px 12px', boxSizing: 'border-box', border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'var(--color-bg-card)' };
  const lbl = { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.05em' };
  const grpTypes = [
    { value: 'client',     label: '🤝 Clientes' },
    { value: 'team',       label: '💼 Time / Equipe' },
    { value: 'friends',    label: '😊 Amigos' },
    { value: 'networking', label: '🌐 Networking' },
    { value: 'supplier',   label: '📦 Fornecedores' },
    { value: 'other',      label: '📁 Outro' },
  ];

  if (loading) return <SectionLoader padding="64px" />;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Identificação */}
      <DsCard>
        <SectionTitle icon="id-card" label="Identificação" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={lbl}>Nome no sistema</label>
            <input value={form.custom_name} onChange={e => set('custom_name', e.target.value)} placeholder={profile?.original_name || 'Nome do grupo'} style={inp} />
            {profile?.original_name && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Nome original no WhatsApp: {profile.original_name}</div>}
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
          <label style={lbl}>Contexto para a IA <span style={{ color: 'var(--color-text-secondary)', textTransform: 'none', fontWeight: 400 }}>— ajuda a IA entender o propósito deste grupo</span></label>
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
            <label style={lbl}>Link do Cérebro GPT <span style={{ color: 'var(--color-text-secondary)', textTransform: 'none', fontWeight: 400 }}>— link do ChatGPT customizado do cliente</span></label>
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
              <button onClick={addDoc} style={{ fontSize: '12px', padding: '4px 10px', background: '#f0fdfa', color: 'var(--color-brand-600)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}>
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
        <DsCard style={{ borderLeft: '4px solid var(--color-brand-600)' }}>
          <SectionTitle icon="file-contract" label="Contrato e Escopo" color="var(--color-brand-600)" />
          <div style={{ background: '#f0fdfa', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#0f766e', marginBottom: '16px' }}>
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
              <label style={lbl}>Escopo contratado <span style={{ color: 'var(--color-text-secondary)', textTransform: 'none', fontWeight: 400 }}>— liste o que está incluído no contrato</span></label>
              <textarea value={form.contract_scope} onChange={e => set('contract_scope', e.target.value)}
                placeholder="Ex: Gestão de Instagram (3 posts/semana) + Stories diários + Relatório mensal. NÃO inclui: criação de site, tráfego pago, atendimento ao cliente..."
                rows={5} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>
        </DsCard>
      )}

      {/* Botão salvar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '8px' }}>
        <button onClick={save} disabled={saving} style={{ padding: '10px 28px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saving ? <><Spinner size={14} />&nbsp; Salvando...</> : <><i className="fas fa-save"></i>&nbsp; Salvar Perfil</>}
        </button>
      </div>
    </div>
  );
}

// ── Aba: Participantes ────────────────────────────────────────
function ConvParticipantsTab({ convId }) {
  const [profile, setProfile]       = React.useState(null);
  const [loading, setLoading]       = React.useState(true);
  const [editId, setEditId]         = React.useState(null);
  const [editForm, setEditForm]     = React.useState({});
  const [saving, setSaving]         = React.useState(false);
  const [analyzing, setAnalyzing]   = React.useState({});   // {pid: true}
  const [analyzingAll, setAnalyzingAll] = React.useState(false);
  const [expanded, setExpanded]     = React.useState({});   // {pid: true} — painel IA aberto

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

  const analyzeParticipant = async (p) => {
    setAnalyzing(a => ({ ...a, [p.id]: true }));
    try {
      const result = await window.apiPost('/participants/' + p.id + '/analyze', {
        conversation_id: convId,
        group_name: profile?.name || 'Grupo',
      });
      setProfile(prev => ({
        ...prev,
        participants: prev.participants.map(x =>
          x.id === p.id ? { ...x, ai_profile: result.profile } : x
        ),
      }));
      setExpanded(e => ({ ...e, [p.id]: true }));
      window.showToast('Perfil gerado com sucesso!', 'success');
    } catch(e) {
      window.showToast('Erro ao gerar perfil: ' + (e?.message || 'tente novamente'), 'error');
    } finally {
      setAnalyzing(a => ({ ...a, [p.id]: false }));
    }
  };

  const analyzeAll = async () => {
    setAnalyzingAll(true);
    try {
      const result = await window.apiPost('/conversations/' + convId + '/analyze-participants', {
        group_name: profile?.name || 'Grupo',
        force: false,
      });
      window.showToast(`Análise concluída: ${result.analyzed} perfis gerados, ${result.skipped} ignorados.`, 'success');
      await load(); // recarrega com novos perfis
    } catch(e) {
      window.showToast('Erro na análise em massa.', 'error');
    } finally {
      setAnalyzingAll(false);
    }
  };

  const roles = [
    { value: 'customer',     label: '🧑‍💼 Cliente' },
    { value: 'collaborator', label: '👨‍💻 Colaborador' },
    { value: 'manager',      label: '👑 Gestor' },
    { value: 'bot',          label: '🤖 Bot' },
    { value: 'unknown',      label: '❓ Desconhecido' },
  ];
  const roleColors = { customer: 'var(--color-brand-600)', collaborator: '#16a34a', manager: '#7c3aed', bot: 'var(--color-text-muted)', unknown: 'var(--color-text-secondary)' };
  const roleLabels = { customer: 'Cliente', collaborator: 'Colaborador', manager: 'Gestor', bot: 'Bot', unknown: '—' };
  const inp = { width: '100%', padding: '7px 10px', boxSizing: 'border-box', border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'var(--color-bg-card)' };

  if (loading) return <SectionLoader padding="64px" />;
  const parts = profile?.participants || [];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{parts.length} participante{parts.length !== 1 ? 's' : ''} identificado{parts.length !== 1 ? 's' : ''}</div>
        {parts.length > 0 && (
          <button onClick={analyzeAll} disabled={analyzingAll} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: analyzingAll ? 'var(--color-border-default)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '6px 14px', cursor: analyzingAll ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: 600,
          }}>
            {analyzingAll
              ? <><i className="fas fa-spinner fa-spin" />Analisando...</>
              : <><i className="fas fa-robot" />Analisar todos com IA</>
            }
          </button>
        )}
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
                      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>Nome customizado</label>
                      <input value={editForm.custom_name} onChange={e => setEditForm(f => ({ ...f, custom_name: e.target.value }))} placeholder={p.original_name} style={inp} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') savePart(p); if (e.key === 'Escape') setEditId(null); }}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>Original: {p.original_name}</div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>Papel</label>
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
                    <button onClick={() => savePart(p)} disabled={saving} style={{ padding: '7px 18px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                      {saving ? <Spinner size={12} /> : 'Salvar'}
                    </button>
                    <button onClick={() => setEditId(null)} style={{ padding: '7px 14px', background: 'var(--color-bg-page)', color: 'var(--color-text-muted)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Cancelar</button>
                  </div>
                </div>
              )
              : (
                <div>
                  {/* Header do participante */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px' }}>
                      {p.is_internal ? '👨‍💻' : p.role === 'customer' ? '🧑‍💼' : '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{p.name}</span>
                        {p.custom_name && <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>(orig: {p.original_name})</span>}
                        <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '9999px', background: (roleColors[p.role] || 'var(--color-text-secondary)') + '20', color: roleColors[p.role] || 'var(--color-text-secondary)', fontWeight: 600 }}>
                          {roleLabels[p.role] || p.role}
                        </span>
                        {p.is_internal && <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '9999px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}>Interno</span>}
                        {p.ai_profile && (
                          <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '9999px', background: '#ede9fe', color: '#7c3aed', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))}>
                            <i className="fas fa-robot" style={{ marginRight: '4px' }}></i>Perfil IA
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span><i className="fas fa-comment" style={{ marginRight: '3px' }}></i>{p.message_count} msg</span>
                        {p.last_seen && <span><i className="fas fa-clock" style={{ marginRight: '3px' }}></i>{new Date(p.last_seen).toLocaleDateString('pt-BR')}</span>}
                        {p.group_count > 1 && (
                          <span style={{ color: '#7c3aed' }}>
                            <i className="fas fa-layer-group" style={{ marginRight: '3px' }}></i>em {p.group_count} grupos
                          </span>
                        )}
                        {p.external_id && <span style={{ fontFamily: 'monospace', opacity: 0.6 }}>{p.external_id.split('@')[0]}</span>}
                        {p.ai_profile?.analyzed_at && (
                          <span style={{ color: '#7c3aed', opacity: 0.8 }}>
                            analisado {new Date(p.ai_profile.analyzed_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => analyzeParticipant(p)} disabled={analyzing[p.id]} title="Gerar/atualizar perfil IA" style={{
                        padding: '7px 12px', background: analyzing[p.id] ? 'var(--color-border-default)' : '#ede9fe',
                        color: analyzing[p.id] ? 'white' : '#7c3aed', border: 'none',
                        borderRadius: 'var(--radius-lg)', cursor: analyzing[p.id] ? 'not-allowed' : 'pointer',
                        fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px',
                      }}>
                        {analyzing[p.id] ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-robot" />}
                        {analyzing[p.id] ? '' : 'IA'}
                      </button>
                      <button onClick={() => startEdit(p)} style={{ padding: '7px 14px', background: 'var(--color-bg-page)', color: 'var(--color-text-primary)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="fas fa-pencil-alt"></i> Editar
                      </button>
                    </div>
                  </div>

                  {/* Painel de Perfil IA — expansível */}
                  {p.ai_profile && expanded[p.id] && (() => {
                    const ap = p.ai_profile;
                    const sections = [
                      { key: 'communication_style', icon: 'comments', label: 'Estilo de Comunicação', color: 'var(--color-brand-600)' },
                      { key: 'behavior_patterns',   icon: 'chart-bar', label: 'Padrões de Comportamento', color: '#2563eb' },
                      { key: 'engagement_level',    icon: 'signal',    label: 'Nível de Engajamento', color: '#16a34a' },
                      { key: 'attention_points',    icon: 'exclamation-triangle', label: 'Pontos de Atenção', color: '#dc2626' },
                      { key: 'approach_strategies', icon: 'lightbulb', label: 'Estratégias de Abordagem', color: '#7c3aed' },
                      { key: 'missing_info',        icon: 'question-circle', label: 'Informações que Faltam', color: '#ea580c' },
                    ];
                    return (
                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            <i className="fas fa-robot" style={{ marginRight: '6px' }}></i>Perfil Gerado por IA
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{ap.message_count} msgs analisadas</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {sections.map(s => ap[s.key] ? (
                            <div key={s.key} style={{ background: 'var(--color-bg-page)', borderRadius: '8px', padding: '10px 14px', borderLeft: `3px solid ${s.color}` }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: s.color, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                <i className={`fas fa-${s.icon}`} style={{ marginRight: '5px' }}></i>{s.label}
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.55 }}>{ap[s.key]}</div>
                            </div>
                          ) : null)}
                        </div>
                        <button onClick={() => setExpanded(e => ({ ...e, [p.id]: false }))} style={{
                          marginTop: '10px', width: '100%', padding: '6px', background: 'transparent',
                          border: '1px solid var(--color-border-card)', borderRadius: '6px', color: 'var(--color-text-secondary)',
                          cursor: 'pointer', fontSize: '12px',
                        }}>
                          <i className="fas fa-chevron-up" style={{ marginRight: '5px' }}></i>Recolher
                        </button>
                      </div>
                    );
                  })()}

                  {/* Clica no badge para expandir */}
                  {p.ai_profile && !expanded[p.id] && (
                    <button onClick={() => setExpanded(e => ({ ...e, [p.id]: true }))} style={{
                      marginTop: '10px', width: '100%', padding: '6px', background: '#faf5ff',
                      border: '1px solid #ddd6fe', borderRadius: '6px', color: '#7c3aed',
                      cursor: 'pointer', fontSize: '12px',
                    }}>
                      <i className="fas fa-chevron-down" style={{ marginRight: '5px' }}></i>Ver Perfil IA
                    </button>
                  )}
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

  const getMeta = (tag) => tagMeta[tag] || { label: tag, color: 'var(--color-text-muted)', bg: 'var(--color-bg-page)', icon: 'tag' };

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
                background: days === d ? 'var(--color-brand-600)' : 'var(--color-border-default)',
                color: days === d ? 'white' : 'var(--color-text-placeholder)',
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
            ? <SectionLoader padding="64px" />
            : !data || data.tags.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '64px 32px' }}>
                  <i className="fas fa-tags" style={{ fontSize: '48px', color: 'var(--color-text-placeholder)', display: 'block', marginBottom: '16px' }}></i>
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
                            <div style={{ height: '8px', background: 'var(--color-border-default)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: pct + '%', background: meta.color, borderRadius: '999px', transition: 'width 0.5s ease' }}></div>
                            </div>
                            {/* Top grupos para esta tag */}
                            {t.groups?.length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                {t.groups.slice(0, 4).map(g => (
                                  <span key={g.conv_id} style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '9999px', background: 'var(--color-bg-page)', color: 'var(--color-text-placeholder)' }}>
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
                              <tr key={row.date} style={{ borderBottom: '1px solid var(--color-border-card)', background: i % 2 === 0 ? '#fafafa' : 'var(--color-bg-card)' }}>
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
                                        : <span style={{ color: 'var(--color-text-placeholder)' }}>—</span>
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
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-card)', background: 'var(--color-bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {(() => { const m = getMeta(activeTag); return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fas fa-${m.icon}`} style={{ color: m.color, fontSize: '12px' }}></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{m.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>últimos {days} dias</div>
                    </div>
                  </div>
                ); })()}
              </div>
              <button onClick={() => { setActiveTag(null); setTagMsgs(null); }}
                style={{ background: 'var(--color-bg-page)', border: 'none', borderRadius: 'var(--radius-lg)', padding: '6px 10px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {msgsLoading
                ? <SectionLoader padding="32px" />
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
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>em</span>
                            <button
                              onClick={() => onSelectGroup && onSelectGroup({ conversation_id: msg.conv_id, conversation_name: msg.group_name, temperature_score: 0, open_alerts: 0, followups_pending: 0 })}
                              style={{ fontSize: '11px', color: 'var(--color-brand-600)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>
                              {msg.group_name}
                            </button>
                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{timeStr}</span>
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

// ─────────────────────────────────────────────────────────────
// UserProfileModal — modal para o usuário editar o próprio perfil
// ─────────────────────────────────────────────────────────────
function UserProfileModal({ onClose, onSaved }) {
  const [profile, setProfile]   = React.useState(null);
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail]       = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm]   = React.useState('');
  const [saving, setSaving]     = React.useState(false);
  const [tab, setTab]           = React.useState('profile'); // 'profile' | 'password'

  React.useEffect(() => {
    window.apiGet('/users/me')
      .then(me => {
        setProfile(me);
        setFullName(me.full_name || '');
        setEmail(me.email || '');
      })
      .catch(() => window.showToast('Erro ao carregar perfil', 'error'));
  }, []);

  const inputStyle = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none',
    background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
  };
  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await window.apiPatch('/users/me', {
        full_name: fullName || null,
        email: email || null,
      });
      window.showToast('Perfil atualizado!', 'success');
      onSaved && onSaved(updated);
    } catch (e) {
      window.showToast(e.message || 'Erro ao salvar', 'error');
    } finally { setSaving(false); }
  };

  const handleSavePassword = async () => {
    if (!password) { window.showToast('Digite a nova senha', 'error'); return; }
    if (password.length < 6) { window.showToast('Senha deve ter pelo menos 6 caracteres', 'error'); return; }
    if (password !== confirm) { window.showToast('As senhas não coincidem', 'error'); return; }
    setSaving(true);
    try {
      await window.apiPatch('/users/me', { password });
      window.showToast('Senha alterada com sucesso!', 'success');
      setPassword(''); setConfirm('');
    } catch (e) {
      window.showToast(e.message || 'Erro ao salvar', 'error');
    } finally { setSaving(false); }
  };

  const tabStyle = (id) => ({
    flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer', fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)', fontWeight: tab === id ? 600 : 400, border: 'none',
    background: tab === id ? '#f0fdfa' : 'transparent',
    color: tab === id ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
    borderBottom: tab === id ? '2px solid var(--color-brand-600)' : '2px solid transparent',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-bg-card)', borderRadius: '16px', width: '420px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', background: '#f0fdfa', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-user-circle" style={{ color: 'var(--color-brand-600)', fontSize: '18px' }}></i>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>Meu Perfil</div>
              {profile && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>@{profile.username}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '18px' }}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-default)' }}>
          <button style={tabStyle('profile')} onClick={() => setTab('profile')}>
            <i className="fas fa-id-card" style={{ marginRight: '6px' }}></i>Dados
          </button>
          <button style={tabStyle('password')} onClick={() => setTab('password')}>
            <i className="fas fa-lock" style={{ marginRight: '6px' }}></i>Senha
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {!profile ? (
            <SectionLoader padding="24px" />
          ) : tab === 'profile' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" />
              </div>
              <div>
                <label style={labelStyle}>E-mail de recuperação</label>
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Usado para recuperação de acesso</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button onClick={onClose} style={{ padding: '9px 18px', background: 'var(--color-bg-page)', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveProfile} disabled={saving} style={{ padding: '9px 18px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {saving ? <><Spinner size={12} /> Salvando...</> : <><i className="fas fa-check"></i> Salvar</>}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Nova senha</label>
                <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              </div>
              <div>
                <label style={labelStyle}>Confirmar senha</label>
                <input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button onClick={onClose} style={{ padding: '9px 18px', background: 'var(--color-bg-page)', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleSavePassword} disabled={saving} style={{ padding: '9px 18px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {saving ? <><Spinner size={12} /> Salvando...</> : <><i className="fas fa-key"></i> Alterar Senha</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UsersScreen — Tela dedicada de gestão de usuários (admin)
// ─────────────────────────────────────────────────────────────
function UsersScreen({ onBack }) {
  const [users, setUsers]       = React.useState([]);
  const [stats, setStats]       = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [modal, setModal]       = React.useState(null); // null | 'new' | user object
  const [toggling, setToggling] = React.useState(null);
  const [filter, setFilter]     = React.useState('all'); // 'all' | 'active' | 'inactive'
  const isMobile = useIsMobile();

  const load = () => {
    setLoading(true);
    window.apiGet('/users/stats')
      .then(data => {
        setStats(data);
        setUsers(data);
        setLoading(false);
      })
      .catch(() => {
        // fallback sem stats
        window.apiGet('/users')
          .then(data => { setUsers(data); setStats(data); setLoading(false); })
          .catch(() => { setLoading(false); window.showToast('Erro ao carregar usuários', 'error'); });
      });
  };

  React.useEffect(load, []);

  const handleToggle = async (user) => {
    setToggling(user.id);
    try {
      await window.apiPatch('/users/' + user.id + '/toggle-active', {});
      load();
    } catch (e) {
      window.showToast(e.message || 'Erro', 'error');
    } finally { setToggling(null); }
  };

  const filtered = users.filter(u =>
    filter === 'all' ? true : filter === 'active' ? u.is_active : !u.is_active
  );
  const totalActive   = users.filter(u => u.is_active).length;
  const totalInactive = users.filter(u => !u.is_active).length;

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  const statCards = [
    { label: 'Total de usuários', value: users.length, icon: 'users', color: 'var(--color-brand-600)', bg: '#f0fdfa' },
    { label: 'Ativos',            value: totalActive,  icon: 'user-check', color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Inativos',          value: totalInactive, icon: 'user-slash', color: '#dc2626', bg: '#fef2f2' },
  ];

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Gestão de Usuários"
        subtitle="Gerencie contas, acesso e status de cada usuário"
        actions={
          <button onClick={() => setModal('new')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
            <i className="fas fa-plus"></i> {!isMobile && 'Novo Usuário'}
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {statCards.map(c => (
            <DsCard key={c.label} style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: c.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fas fa-${c.icon}`} style={{ color: c.color, fontSize: '16px' }}></i>
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>{loading ? '—' : c.value}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>{c.label}</div>
                </div>
              </div>
            </DsCard>
          ))}
        </div>

        {/* Filtro tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all',      label: `Todos (${users.length})` },
            { id: 'active',   label: `Ativos (${totalActive})` },
            { id: 'inactive', label: `Inativos (${totalInactive})` },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1px solid ' + (filter === f.id ? 'var(--color-brand-600)' : 'var(--color-border-default)'),
              background: filter === f.id ? '#f0fdfa' : 'var(--color-bg-card)',
              color: filter === f.id ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
              fontWeight: filter === f.id ? 600 : 400,
            }}>{f.label}</button>
          ))}
        </div>

        {/* Lista de usuários */}
        <DsCard style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <SectionLoader />
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              <i className="fas fa-users" style={{ fontSize: '32px', display: 'block', marginBottom: '12px', opacity: 0.3 }}></i>
              Nenhum usuário encontrado.
            </div>
          ) : (
            <div>
              {/* Header da tabela (desktop) */}
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', padding: '10px 20px', borderBottom: '1px solid var(--color-border-default)', background: 'var(--color-bg-page)' }}>
                  {['Usuário', 'Status', 'Conversas', 'Último acesso', ''].map(h => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</div>
                  ))}
                </div>
              )}
              {filtered.map((u, idx) => (
                <div key={u.id} style={{
                  display: isMobile ? 'flex' : 'grid',
                  gridTemplateColumns: isMobile ? undefined : '2fr 1fr 1fr 1fr auto',
                  flexDirection: isMobile ? 'column' : undefined,
                  gap: '12px', padding: isMobile ? '14px 16px' : '14px 20px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-border-default)' : 'none',
                  background: u.is_active ? 'transparent' : '#fef2f2',
                  alignItems: isMobile ? undefined : 'center',
                }}>
                  {/* Usuário */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9999px', background: u.is_active ? '#ccfbf1' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                      <i className="fas fa-user" style={{ color: u.is_active ? 'var(--color-brand-600)' : '#ef4444', fontSize: '14px' }}></i>
                      {u.is_admin && (
                        <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '13px', height: '13px', background: '#f59e0b', borderRadius: '9999px', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fas fa-star" style={{ fontSize: '6px', color: 'white' }}></i>
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{u.full_name || u.username}</span>
                        {u.is_admin && <span style={{ background: '#ede9fe', color: '#7c3aed', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px' }}>Admin</span>}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>@{u.username}{u.email ? ` · ${u.email}` : ''}</div>
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                      background: u.is_active ? '#dcfce7' : '#fee2e2',
                      color: u.is_active ? '#16a34a' : '#dc2626',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '9999px', background: 'currentColor', display: 'inline-block' }}></span>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Conversas */}
                  {!isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                      <i className="fas fa-comments" style={{ color: 'var(--color-text-secondary)', marginRight: '6px', fontSize: '12px' }}></i>
                      {u.conversations_count ?? '—'}
                      {u.messages_count > 0 && <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', marginLeft: '4px' }}>({u.messages_count} msgs)</span>}
                    </div>
                  )}

                  {/* Último acesso */}
                  {!isMobile && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <i className="fas fa-clock" style={{ fontSize: '11px' }}></i>
                      {formatDate(u.last_login_at)}
                    </div>
                  )}

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: isMobile ? 'flex-end' : undefined }}>
                    <button onClick={() => setModal(u)} title="Editar" style={{ padding: '6px 10px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '13px' }}>
                      <i className="fas fa-pen"></i>
                    </button>
                    <button
                      onClick={() => handleToggle(u)}
                      disabled={toggling === u.id}
                      title={u.is_active ? 'Desativar' : 'Ativar'}
                      style={{ padding: '6px 10px', background: u.is_active ? '#fef2f2' : '#f0fdf4', border: '1px solid ' + (u.is_active ? '#fecaca' : '#bbf7d0'), borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: u.is_active ? '#dc2626' : '#16a34a', fontSize: '13px' }}
                    >
                      {toggling === u.id ? <Spinner size={12} color={u.is_active ? '#dc2626' : '#16a34a'} /> : <i className={'fas fa-' + (u.is_active ? 'user-slash' : 'user-check')}></i>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DsCard>
      </div>

      {modal && (
        <UserFormModal
          editing={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EmailAccountsSection — usado dentro do ConfigScreen
// ─────────────────────────────────────────────────────────────
function EmailAccountsSection() {
  const [accounts, setAccounts]   = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [showForm, setShowForm]   = React.useState(false);
  const [testing, setTesting]     = React.useState(null);
  const [deleting, setDeleting]   = React.useState(null);

  const emptyForm = { label: '', host: '', port: '993', username: '', password: '', use_ssl: true };
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);

  const load = () => {
    setLoading(true);
    window.apiGet('/email-accounts')
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  };

  React.useEffect(load, []);

  const handleSave = async () => {
    if (!form.label.trim() || !form.host.trim() || !form.username.trim() || !form.password.trim()) {
      window.showToast('Preencha todos os campos obrigatórios', 'warning'); return;
    }
    setSaving(true);
    try {
      await window.apiPost('/email-accounts', {
        label: form.label.trim(),
        host: form.host.trim(),
        port: parseInt(form.port) || 993,
        username: form.username.trim(),
        password: form.password,
        use_ssl: form.use_ssl,
      });
      window.showToast('Conta de e-mail adicionada!', 'success');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e) {
      window.showToast('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta conta de e-mail?')) return;
    setDeleting(id);
    try {
      await window.apiDelete('/email-accounts/' + id);
      window.showToast('Conta removida', 'info');
      load();
    } catch (e) {
      window.showToast('Erro ao remover: ' + e.message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleTest = async (id) => {
    setTesting(id);
    try {
      const r = await window.apiPost('/email-accounts/' + id + '/test', {});
      window.showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, r.ok ? 'success' : 'error');
      if (!r.ok) load();
    } catch (e) {
      window.showToast('Erro: ' + e.message, 'error');
    } finally {
      setTesting(null);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none',
    background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
  };
  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' };

  return (
    <DsCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <SectionTitle icon="envelope" label="Contas de E-mail Monitoradas" color="var(--color-brand-600)" />
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: showForm ? 'var(--color-bg-page)' : 'var(--color-brand-600)', color: showForm ? 'var(--color-text-primary)' : 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontWeight: 500, fontFamily: 'var(--font-sans)' }}
        >
          <i className={`fas fa-${showForm ? 'times' : 'plus'}`}></i> {showForm ? 'Cancelar' : 'Adicionar conta'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Nome / Rótulo *</label>
              <input style={inputStyle} value={form.label} onChange={e => setForm(f => ({...f, label: e.target.value}))} placeholder="Ex: Suporte, Comercial..." />
            </div>
            <div>
              <label style={labelStyle}>Host IMAP *</label>
              <input style={inputStyle} value={form.host} onChange={e => setForm(f => ({...f, host: e.target.value}))} placeholder="Ex: imap.gmail.com" />
            </div>
            <div>
              <label style={labelStyle}>Login / E-mail *</label>
              <input style={inputStyle} type="email" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} placeholder="conta@empresa.com" />
            </div>
            <div>
              <label style={labelStyle}>Senha *</label>
              <input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Senha ou App Password" />
            </div>
            <div>
              <label style={labelStyle}>Porta</label>
              <input style={inputStyle} type="number" value={form.port} onChange={e => setForm(f => ({...f, port: e.target.value}))} placeholder="993" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '26px' }}>
              <input type="checkbox" id="use_ssl" checked={form.use_ssl} onChange={e => setForm(f => ({...f, use_ssl: e.target.checked}))} style={{ width: '16px', height: '16px', accentColor: 'var(--color-brand-600)', cursor: 'pointer' }} />
              <label htmlFor="use_ssl" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Usar SSL/TLS</label>
            </div>
          </div>
          <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#0f766e' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
            Para Gmail, use uma <strong>App Password</strong> (Configurações → Segurança → Senhas de app). Porta padrão IMAP SSL: 993.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
              {saving ? <><Spinner size={12} />&nbsp; Salvando...</> : <><i className="fas fa-check"></i>&nbsp; Salvar conta</>}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <SectionLoader padding="24px" />
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
          <i className="fas fa-envelope-open" style={{ fontSize: '28px', marginBottom: '10px', display: 'block', opacity: 0.4 }}></i>
          <div style={{ fontSize: 'var(--text-sm)' }}>Nenhuma conta de e-mail configurada.</div>
          <div style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>Adicione uma conta acima para começar o monitoramento.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-envelope" style={{ color: 'var(--color-brand-600)', fontSize: '16px' }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>{acc.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{acc.username} · {acc.host}:{acc.port} {acc.use_ssl ? '(SSL)' : ''}</div>
                {acc.last_error && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}><i className="fas fa-exclamation-circle"></i> {acc.last_error}</div>}
                {acc.last_sync_at && !acc.last_error && <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}><i className="fas fa-check-circle"></i> Última sync: {new Date(acc.last_sync_at).toLocaleString('pt-BR')}</div>}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleTest(acc.id)} disabled={testing === acc.id}
                  style={{ padding: '6px 12px', background: '#f0fdfa', color: 'var(--color-brand-600)', border: '1px solid #99f6e4', borderRadius: '8px', fontSize: '12px', cursor: testing === acc.id ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
                  title="Testar conexão IMAP"
                >
                  {testing === acc.id ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-plug"></i> Testar</>}
                </button>
                <button
                  onClick={() => handleDelete(acc.id)} disabled={deleting === acc.id}
                  style={{ padding: '6px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '8px', fontSize: '12px', cursor: deleting === acc.id ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}
                  title="Remover conta"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DsCard>
  );
}

// ─────────────────────────────────────────────────────────────
// EmailScreen — Monitor de e-mails (lista de contas + inbox)
// ─────────────────────────────────────────────────────────────
function EmailScreen({ onNavigateConfig }) {
  const [accounts, setAccounts]     = React.useState([]);
  const [loading, setLoading]       = React.useState(true);
  const [selected, setSelected]     = React.useState(null);
  const isMobile                    = useIsMobile();

  React.useEffect(() => {
    window.apiGet('/email-accounts')
      .then(data => {
        setAccounts(data);
        if (data.length > 0 && !isMobile) setSelected(data[0]);
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const initials = (label) => label.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors   = ['var(--color-brand-600)', '#0891b2', '#7c3aed', '#be185d', '#d97706', '#15803d'];
  const colorFor = (i) => colors[i % colors.length];

  const EmptyAccounts = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
        <i className="fas fa-envelope" style={{ fontSize: '28px', color: 'var(--color-brand-600)' }}></i>
      </div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)', marginBottom: '8px' }}>Nenhuma conta configurada</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', maxWidth: '320px', lineHeight: 1.6 }}>
        Adicione contas IMAP nas configurações para monitorar e-mails recebidos.
      </div>
      <button
        onClick={() => onNavigateConfig && onNavigateConfig()}
        style={{ marginTop: '24px', padding: '10px 22px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <i className="fas fa-cog"></i> Ir para Configurações
      </button>
    </div>
  );

  const AccountList = () => (
    <div style={{ width: isMobile ? '100%' : '320px', borderRight: isMobile ? 'none' : '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'var(--color-bg-card)', height: '100%' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-default)', background: 'var(--color-bg-page)' }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Contas monitoradas</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {accounts.map((acc, i) => (
          <div
            key={acc.id}
            onClick={() => { setSelected(acc); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--color-border-default)',
              background: selected?.id === acc.id ? '#f0fdfa' : 'var(--color-bg-card)',
              borderLeft: selected?.id === acc.id ? `3px solid ${colorFor(i)}` : '3px solid transparent',
              transition: 'background 0.12s',
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: colorFor(i), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontWeight: 700, fontSize: '15px' }}>
              {initials(acc.label)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.username}</div>
              {acc.last_error && (
                <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>
                  <i className="fas fa-exclamation-circle"></i> Erro de conexão
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: acc.last_error ? '#ef4444' : '#22c55e' }} title={acc.last_error ? 'Erro' : 'Ativo'}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const InboxPanel = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg-page)', height: '100%' }}>
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
          <i className="fas fa-envelope-open" style={{ fontSize: '48px', color: 'var(--color-text-on-sidebar-muted)', marginBottom: '16px' }}></i>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Selecione uma conta para ver os e-mails</div>
        </div>
      ) : (
        <>
          <div style={{ padding: '16px 24px', background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '15px', flexShrink: 0 }}>
              {initials(selected.label)}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{selected.label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{selected.username} · {selected.host}</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ background: 'var(--color-bg-card)', borderRadius: '16px', padding: '32px 40px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '440px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <i className="fas fa-cogs" style={{ fontSize: '22px', color: 'var(--color-brand-600)' }}></i>
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                Leitura de e-mails em breve
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                A conta <strong>{selected.label}</strong> está configurada. O módulo de ingestão IMAP está em desenvolvimento — em breve os e-mails recebidos serão exibidos aqui e processados pela IA.
              </div>
              <div style={{ marginTop: '20px', padding: '12px 16px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '10px', fontSize: 'var(--text-xs)', color: '#0f766e', textAlign: 'left' }}>
                <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i>
                Credenciais salvas · Conexão IMAP configurada em <strong>Configurações</strong>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="E-mails"
        subtitle="Monitoramento de caixas de entrada"
        actions={
          <button
            onClick={() => onNavigateConfig && onNavigateConfig()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--color-bg-page)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
          >
            <i className="fas fa-plus" style={{ color: 'var(--color-brand-600)' }}></i> Adicionar conta
          </button>
        }
      />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SectionLoader />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyAccounts />
        ) : (
          <>
            {(!isMobile || !selected) && <AccountList />}
            {(!isMobile || selected) && <InboxPanel />}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WppGroupsManagerScreen — Selecionar grupos para monitorar
// ─────────────────────────────────────────────────────────────
function WppGroupsManagerScreen({ onSelectGroup }) {
  const [groups,        setGroups]        = React.useState([]);
  const [statsMap,      setStatsMap]      = React.useState({});
  const [hoveredId,     setHoveredId]     = React.useState(null);
  const [loading,       setLoading]       = React.useState(true);
  const [search,        setSearch]        = React.useState('');
  const [filter,        setFilter]        = React.useState('all'); // all | monitored | unmonitored
  const [toggling,      setToggling]      = React.useState({});   // wpp_id → bool
  const [editingId,     setEditingId]     = React.useState(null);
  const [editName,      setEditName]      = React.useState('');
  const [pendingToggle, setPendingToggle] = React.useState(null);  // grupo aguardando escolha de período

  // null = ilimitado; número = limite em dias
  const _mhdRaw = localStorage.getItem('envox_max_history_days');
  const maxHistoryDays = (_mhdRaw === '' || _mhdRaw === null) ? null : parseInt(_mhdRaw, 10);

  // -1 = ilimitado; número = limite de grupos
  const _mgRaw = localStorage.getItem('envox_max_groups');
  const maxGroups = (_mgRaw === null || _mgRaw === '-1') ? -1 : parseInt(_mgRaw, 10);

  const load = () => {
    setLoading(true);
    Promise.all([
      window.apiGet('/wpp/available-groups'),
      window.apiGet('/dashboard/groups').catch(() => []),
    ]).then(([wppGroups, dashGroups]) => {
      setGroups(Array.isArray(wppGroups) ? wppGroups : []);
      const sm = {};
      (Array.isArray(dashGroups) ? dashGroups : []).forEach(dg => {
        if (dg.conversation_id) {
          sm[dg.conversation_id] = {
            temperature_score: dg.temperature_score || 0,
            open_alerts: dg.open_alerts || 0,
            followups_pending: dg.followups_pending || 0,
            conversation_name: dg.conversation_name || '',
          };
        }
      });
      setStatsMap(sm);
    })
    .catch(() => window.showToast('Erro ao carregar grupos. Verifique a conexão WhatsApp.', 'error'))
    .finally(() => setLoading(false));
  };

  React.useEffect(load, []);

  const filtered = groups.filter(g => {
    const name = (g.name || g.custom_name || '').toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase())
      || (g.custom_name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all'
      || (filter === 'monitored' && g.is_monitored)
      || (filter === 'unmonitored' && !g.is_monitored);
    return matchSearch && matchFilter;
  });

  const monitoredCount = groups.filter(g => g.is_monitored).length;

  function handleToggle(g) {
    if (!g.is_monitored) {
      // Ativar → abre modal de escolha de período
      setPendingToggle(g);
      return;
    }
    // Desativar → direto
    confirmToggle(g, null);
  }

  async function confirmToggle(g, days_back) {
    setPendingToggle(null);
    setToggling(t => ({ ...t, [g.wpp_id]: true }));
    try {
      await window.apiPost('/wpp/groups/toggle', {
        wpp_id: g.wpp_id,
        name: g.name,
        participant_count: g.participant_count,
        enable: !g.is_monitored,
        days_back,
      });
      setGroups(prev => prev.map(x =>
        x.wpp_id === g.wpp_id ? { ...x, is_monitored: !x.is_monitored } : x
      ));
      if (g.is_monitored) {
        window.showToast('Monitoramento desativado.', 'info');
      } else if (days_back === 0) {
        window.showToast('Grupo ativado! Monitorando a partir de agora.', 'success');
      } else {
        const label = days_back === null ? 'todo o histórico disponível' : `os últimos ${days_back} dias`;
        window.showToast(`Grupo ativado! Importando ${label}...`, 'success');
      }
    } catch(err) {
      const msg = err?.message || '';
      if (msg.includes('403') || msg.includes('Limite')) {
        window.showToast(msg.replace(/^[^:]+:\s*/, '') || 'Limite de grupos do plano atingido. Faça upgrade.', 'error');
      } else {
        window.showToast('Erro ao alterar monitoramento.', 'error');
      }
    } finally {
      setToggling(t => ({ ...t, [g.wpp_id]: false }));
    }
  }

  async function saveCustomName(g) {
    try {
      const encoded = encodeURIComponent(g.wpp_id);
      await fetch(`/api/v1/wpp/groups/${encoded}/name`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + window.getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_name: editName }),
      });
      setGroups(prev => prev.map(x =>
        x.wpp_id === g.wpp_id ? { ...x, custom_name: editName || null } : x
      ));
      window.showToast('Nome atualizado!', 'success');
    } catch { window.showToast('Erro ao salvar nome.', 'error'); }
    finally { setEditingId(null); }
  }

  const isMobile = useIsMobile();

  function GroupCard({ g }) {
    const isToggling = toggling[g.wpp_id];
    const wppName = g.name || g.wpp_id;
    const initials = wppName.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
    const isEditing = editingId === g.wpp_id;
    const knownParticipants = (g.participants || []);
    const showParticipants = knownParticipants.slice(0, 5);
    const extraCount = knownParticipants.length - showParticipants.length;
    const stats = (g.conversation_id && statsMap[g.conversation_id]) || {};
    const tempScore = stats.temperature_score || 0;
    const openAlerts = stats.open_alerts || 0;
    const followups = stats.followups_pending || 0;
    const canNavigate = g.is_monitored && !!g.conversation_id && !!onSelectGroup;
    const isHovered = hoveredId === g.wpp_id;

    function handleGroupDetail() {
      if (!canNavigate) return;
      onSelectGroup({
        conversation_id: g.conversation_id,
        conversation_name: g.custom_name || stats.conversation_name || g.name || g.wpp_id,
        temperature_score: tempScore,
        open_alerts: openAlerts,
        followups_pending: followups,
      });
    }

    return (
      <div
        onClick={canNavigate ? handleGroupDetail : undefined}
        onMouseEnter={canNavigate ? () => setHoveredId(g.wpp_id) : undefined}
        onMouseLeave={canNavigate ? () => setHoveredId(null) : undefined}
        style={{
          background: isHovered ? 'var(--color-bg-hover-sidebar)' : 'var(--color-bg-card)',
          border: `1px solid ${g.is_monitored ? 'var(--color-brand-600)' : 'var(--color-border-default)'}`,
          borderRadius: '12px', padding: '14px 16px',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          transition: 'border-color 0.2s, background 0.12s',
          cursor: canNavigate ? 'pointer' : 'default',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
          background: g.is_monitored ? 'linear-gradient(135deg,var(--color-brand-600),#075e54)' : 'var(--color-border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 700, color: 'white',
        }}>
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveCustomName(g); if (e.key === 'Escape') setEditingId(null); }}
                style={{
                  flex: 1, background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-600)', borderRadius: '6px',
                  color: 'var(--color-text-primary)', padding: '4px 8px', fontSize: '14px',
                }}
              />
              <button onClick={() => saveCustomName(g)} style={{ background: 'var(--color-brand-600)', border: 'none', borderRadius: '6px', color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: '13px' }}>OK</button>
              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '13px' }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {wppName}
              </span>
              {g.is_monitored && (
                <button
                  onClick={e => { e.stopPropagation(); setEditingId(g.wpp_id); setEditName(g.custom_name || g.name || ''); }}
                  title="Editar apelido"
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px', fontSize: '11px', flexShrink: 0 }}
                >
                  <i className="fas fa-pen" />
                </button>
              )}
            </div>
          )}
          {g.custom_name && !isEditing && (
            <div style={{ fontSize: '11px', color: 'var(--color-brand-600)', marginTop: '1px', fontStyle: 'italic' }}>
              Apelido: {g.custom_name}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <i className="fas fa-users" style={{ marginRight: '4px' }}></i>{g.participant_count} participantes
            </span>
            {g.is_monitored && (
              <span style={{ fontSize: '11px', background: 'rgba(13,148,136,0.15)', color: 'var(--color-brand-600)', padding: '1px 8px', borderRadius: '999px', fontWeight: 600 }}>
                Monitorado
              </span>
            )}
          </div>
          {/* Stats row — temperatura, alertas, follow-ups (apenas grupos monitorados) */}
          {g.is_monitored && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: tempScore >= 60 ? '#10b981' : tempScore >= 40 ? '#f59e0b' : '#ef4444' }}>
                🌡 {tempScore}°
              </span>
              {openAlerts > 0 && (
                <span style={{ fontSize: '11px', color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '1px 7px', borderRadius: '999px' }}>
                  🔔 {openAlerts} alerta{openAlerts > 1 ? 's' : ''}
                </span>
              )}
              {followups > 0 && (
                <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '1px 7px', borderRadius: '999px' }}>
                  ⏰ {followups} follow-up
                </span>
              )}
              {canNavigate && (
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: isHovered ? 'var(--color-brand-600)' : 'var(--color-text-placeholder)', transition: 'color 0.15s' }}>
                  Ver detalhes <i className="fas fa-chevron-right" style={{ fontSize: '9px' }} />
                </span>
              )}
            </div>
          )}
          {showParticipants.length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {showParticipants.map((name, i) => (
                <span key={i} style={{
                  fontSize: '11px', background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)',
                  padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--color-border-default)',
                  maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{name}</span>
              ))}
              {extraCount > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '2px 4px' }}>+{extraCount}</span>
              )}
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={e => { e.stopPropagation(); handleToggle(g); }}
          disabled={isToggling}
          style={{
            background: g.is_monitored ? 'var(--color-brand-600)' : 'var(--color-border-default)',
            border: 'none', borderRadius: '8px', cursor: isToggling ? 'wait' : 'pointer',
            color: 'white', padding: '8px 14px', fontSize: '12px', fontWeight: 600,
            flexShrink: 0, opacity: isToggling ? 0.6 : 1, transition: 'background 0.2s',
            minWidth: '90px', textAlign: 'center',
          }}
        >
          {isToggling ? <i className="fas fa-spinner fa-spin" /> : g.is_monitored ? 'Desativar' : 'Monitorar'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Grupos WhatsApp"
        subtitle={maxGroups === -1
          ? `${monitoredCount} monitorado(s) de ${groups.length} disponíveis · Grupos ilimitados`
          : `${monitoredCount} / ${maxGroups} grupos do plano · ${groups.length} disponíveis`}
        actions={
          <button onClick={load} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px' }}>
            <i className="fas fa-sync-alt" style={{ marginRight: '6px' }}></i>Atualizar
          </button>
        }
      />

      {/* Filters */}
      <div style={{ padding: '0 24px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar grupo..."
          style={{
            flex: 1, minWidth: '200px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
            borderRadius: '8px', color: 'var(--color-text-primary)', padding: '9px 14px', fontSize: '14px',
          }}
        />
        {['all', 'monitored', 'unmonitored'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? 'var(--color-brand-600)' : 'var(--color-bg-card)',
            border: `1px solid ${filter === f ? 'var(--color-brand-600)' : 'var(--color-border-default)'}`,
            borderRadius: '8px', color: filter === f ? 'white' : 'var(--color-text-secondary)',
            padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
          }}>
            {f === 'all' ? 'Todos' : f === 'monitored' ? 'Monitorados' : 'Não monitorados'}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {loading ? (
          <SectionLoader label="Carregando grupos..." padding="56px" />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '60px', color: 'var(--color-text-muted)' }}>
            <i className="fas fa-users-slash" style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}></i>
            Nenhum grupo encontrado.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(g => <GroupCard key={g.wpp_id} g={g} />)}
          </div>
        )}
      </div>

      {/* Modal de escolha de período de backfill */}
      {pendingToggle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setPendingToggle(null)}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '16px', padding: '28px', width: 'min(460px, 100%)', boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-clock" style={{ color: '#14b8a6', fontSize: '18px' }}></i>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text-primary)', marginBottom: '4px' }}>Recuperar histórico</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  Quanto tempo de histórico deseja importar para <strong style={{ color: 'var(--color-text-secondary)' }}>{pendingToggle.name || pendingToggle.wpp_id}</strong>?
                </div>
              </div>
            </div>

            {/* Opções */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {[
                { label: 'A partir de agora', sub: 'Sem histórico — só novas mensagens', days: 0    },
                { label: 'Últimos 3 meses',   sub: '90 dias de histórico',              days: 90   },
                { label: 'Últimos 6 meses',   sub: '180 dias de histórico',             days: 180  },
                { label: 'Último ano',         sub: '365 dias de histórico',             days: 365  },
                { label: 'Desde o começo',     sub: 'Todo o histórico disponível',       days: null },
              ].map(opt => {
                // Bloqueado quando o plano tem limite e a opção ultrapassa esse limite
                const locked = opt.days !== 0 && maxHistoryDays !== null && (opt.days === null || opt.days > maxHistoryDays);
                return (
                <button key={String(opt.days)} disabled={locked}
                  onClick={() => !locked && confirmToggle(pendingToggle, opt.days)}
                  style={{
                    background: locked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid ' + (locked ? 'var(--color-border-card)' : 'var(--color-border-default)'),
                    borderRadius: '10px', padding: '12px 16px', cursor: locked ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'background 0.15s, border-color 0.15s',
                    opacity: locked ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!locked) { e.currentTarget.style.background = 'rgba(20,184,166,0.1)'; e.currentTarget.style.borderColor = '#14b8a6'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = locked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = locked ? 'var(--color-border-card)' : 'var(--color-border-default)'; }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: locked ? 'var(--color-text-placeholder)' : 'var(--color-text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: '12px', color: locked ? 'var(--color-text-primary)' : 'var(--color-text-muted)', marginTop: '2px' }}>{opt.sub}</div>
                  </div>
                  {locked ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}
                      onMouseEnter={e => { const t = e.currentTarget.querySelector('.hist-tip'); if (t) t.style.opacity = '1'; }}
                      onMouseLeave={e => { const t = e.currentTarget.querySelector('.hist-tip'); if (t) t.style.opacity = '0'; }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap', cursor: 'not-allowed' }}>
                        <i className="fas fa-lock" style={{ marginRight: '4px', fontSize: '10px' }}></i>Upgrade necessário
                      </span>
                      <div className="hist-tip" style={{
                        position: 'absolute', bottom: 'calc(100% + 6px)', right: 0,
                        background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '8px',
                        padding: '6px 10px', fontSize: '11px', color: 'var(--color-text-secondary)',
                        whiteSpace: 'nowrap', pointerEvents: 'none',
                        opacity: 0, transition: 'opacity 0.15s', zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      }}>
                        Faça upgrade do seu plano para desbloquear
                        <div style={{ position: 'absolute', bottom: '-5px', right: '14px', width: '8px', height: '8px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderTop: 'none', borderLeft: 'none', transform: 'rotate(45deg)' }}></div>
                      </div>
                    </div>
                  ) : (
                    <i className="fas fa-chevron-right" style={{ color: 'var(--color-text-placeholder)', fontSize: '12px' }}></i>
                  )}
                </button>
                );
              })}
            </div>

            <button onClick={() => setPendingToggle(null)}
              style={{ width: '100%', background: 'transparent', border: '1px solid var(--color-border-default)', borderRadius: '10px', padding: '10px', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// RangeSummaryScreen — Resumo por período customizado
// ─────────────────────────────────────────────────────────────
function RangeSummaryScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [conversations,  setConversations]  = React.useState([]);
  const [convSearch,     setConvSearch]     = React.useState('');
  const [selectedConv,   setSelectedConv]   = React.useState(null);
  const [startDate,      setStartDate]      = React.useState(weekAgo);
  const [endDate,        setEndDate]        = React.useState(today);
  const [loading,        setLoading]        = React.useState(false);
  const [loadingConvs,   setLoadingConvs]   = React.useState(false);
  const [result,         setResult]         = React.useState(null);
  const [showConvList,   setShowConvList]   = React.useState(false);
  const [summaryType,    setSummaryType]    = React.useState('executive'); // 'executive' | 'general'
  const [sending,        setSending]        = React.useState(false);
  const [editingText,    setEditingText]    = React.useState(null); // null = não editando; string = texto editado

  const isMobile = useIsMobile();

  // Carrega conversas
  React.useEffect(() => {
    setLoadingConvs(true);
    window.apiGet('/conversations?limit=200')
      .then(d => setConversations(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingConvs(false));
  }, []);

  // Ao trocar o tipo de resumo, sincroniza o texto de edição com o resultado atual
  React.useEffect(() => {
    if (result && summaryType === 'general') setEditingText(result.general_text || '');
    else setEditingText(null);
  }, [summaryType, result]);

  const filteredConvs = conversations.filter(c =>
    !convSearch || c.name.toLowerCase().includes(convSearch.toLowerCase())
  );

  function setQuickRange(days) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  }

  function setTodayRange() {
    const d = new Date().toISOString().slice(0, 10);
    setStartDate(d); setEndDate(d);
  }

  function setYesterdayRange() {
    const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    setStartDate(d); setEndDate(d);
  }

  async function handleGenerate() {
    if (!selectedConv) { window.showToast('Selecione um grupo.', 'warning'); return; }
    if (!startDate || !endDate) { window.showToast('Informe o período.', 'warning'); return; }
    if (startDate > endDate) { window.showToast('Data inicial deve ser anterior à final.', 'warning'); return; }

    setLoading(true);
    setResult(null);
    setEditingText(null);
    try {
      const data = await window.apiGet(
        `/conversations/${selectedConv.id}/range-summary?start_date=${startDate}&end_date=${endDate}`
      );
      setResult(data);
      if (summaryType === 'general') setEditingText(data.general_text || '');
    } catch(e) {
      window.showToast('Erro ao gerar resumo. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendToGroup() {
    if (!result || !selectedConv) return;
    const textToSend = (editingText !== null ? editingText : result.general_text || '').trim();
    if (!textToSend) { window.showToast('Texto do resumo está vazio.', 'warning'); return; }

    if (!result.conversation.wpp_group_id) {
      window.showToast('Este grupo não tem ID WhatsApp configurado. Associe-o na tela de Grupos WhatsApp.', 'error');
      return;
    }

    setSending(true);
    try {
      const r = await fetch(`/api/v1/conversations/${selectedConv.id}/send-general-summary`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + window.getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend }),
      });
      if (!r.ok) {
        let detail = 'Falha ao enviar. Verifique a conexão WhatsApp.';
        try { const j = await r.json(); detail = j.detail || detail; } catch(_) {}
        window.showToast(detail, 'error');
        return;
      }
      window.showToast('Resumo enviado com sucesso para o grupo!', 'success');
    } catch(e) {
      window.showToast('Erro de rede ao enviar. Verifique sua conexão.', 'error');
    } finally {
      setSending(false);
    }
  }

  const TEMP_COLORS = { critico: '#ef4444', alerta: '#f59e0b', moderado: '#3b82f6', saudavel: '#10b981' };
  const TEMP_LABELS = { critico: 'Crítico', alerta: 'Em Alerta', moderado: 'Moderado', saudavel: 'Saudável' };

  function StatBox({ label, value, color, icon }) {
    return (
      <div style={{ background: 'var(--color-bg-card)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--color-border-default)' }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>
          <i className={`fas fa-${icon}`} style={{ marginRight: '5px' }}></i>{label}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: color || 'var(--color-text-primary)' }}>{value}</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="Resumo por Período" subtitle="Analise qualquer grupo em qualquer faixa de datas" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>

        {/* ── Formulário ── */}
        <div style={{
          background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '14px',
          padding: '20px', marginBottom: '24px',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px',
          alignItems: 'end',
        }}>

          {/* Seleção de grupo */}
          <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-users" style={{ marginRight: '6px' }}></i>Grupo / Conversa
            </label>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowConvList(v => !v)}
                style={{
                  background: 'var(--color-bg-card)', border: `1px solid ${showConvList ? 'var(--color-brand-600)' : 'var(--color-border-input)'}`,
                  borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: selectedConv ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontSize: '14px',
                }}
              >
                <span>{selectedConv ? selectedConv.name : 'Selecionar grupo...'}</span>
                <i className={`fas fa-chevron-${showConvList ? 'up' : 'down'}`} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }} />
              </div>
              {showConvList && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden', marginTop: '4px',
                }}>
                  <div style={{ padding: '8px' }}>
                    <input
                      autoFocus
                      value={convSearch}
                      onChange={e => setConvSearch(e.target.value)}
                      placeholder="Buscar..."
                      style={{
                        width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                        borderRadius: '6px', color: 'var(--color-text-primary)', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {loadingConvs ? (
                      <div style={{ padding: '16px', textAlign: 'center' }}><LoadingDots size={4} /></div>
                    ) : filteredConvs.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Nenhum grupo encontrado.</div>
                    ) : filteredConvs.map(c => (
                      <div
                        key={c.id}
                        onClick={() => { setSelectedConv(c); setShowConvList(false); setConvSearch(''); }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                          color: selectedConv?.id === c.id ? 'var(--color-brand-600)' : 'var(--color-text-primary)',
                          background: selectedConv?.id === c.id ? 'rgba(13,148,136,0.1)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (selectedConv?.id !== c.id) e.currentTarget.style.background = 'var(--color-border-default)'; }}
                        onMouseLeave={e => { if (selectedConv?.id !== c.id) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Data início */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>Data Inicial
            </label>
            <input
              type="date" value={startDate} max={endDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Data fim */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-calendar-check" style={{ marginRight: '6px' }}></i>Data Final
            </label>
            <input
              type="date" value={endDate} min={startDate} max={today}
              onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Tipo de resumo */}
          <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
              <i className="fas fa-file-alt" style={{ marginRight: '6px' }}></i>Tipo de Resumo
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { key: 'executive', icon: 'chart-line', label: 'Executivo Estratégico', desc: 'KPIs, tags, alertas — uso interno' },
                { key: 'general',   icon: 'comments',   label: 'Resumo Geral',           desc: 'Texto descritivo — envio no grupo' },
              ].map(({ key, icon, label, desc }) => (
                <button
                  key={key}
                  onClick={() => { setSummaryType(key); setResult(null); setEditingText(null); }}
                  style={{
                    flex: 1, background: summaryType === key ? 'rgba(13,148,136,0.15)' : 'var(--color-bg-card)',
                    border: `2px solid ${summaryType === key ? 'var(--color-brand-600)' : 'var(--color-border-default)'}`,
                    borderRadius: '10px', padding: '10px 14px', cursor: 'pointer',
                    textAlign: 'left', transition: 'all .15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                    <i className={`fas fa-${icon}`} style={{ color: summaryType === key ? 'var(--color-brand-600)' : 'var(--color-text-muted)', fontSize: '13px' }} />
                    <span style={{ fontWeight: 600, fontSize: '13px', color: summaryType === key ? 'var(--color-brand-600)' : 'var(--color-text-primary)' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Atalhos + botão */}
          <div style={{ gridColumn: isMobile ? '1' : '1 / -1', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Atalhos:</span>
            {[['hoje', 'Hoje', setTodayRange], ['ontem', 'Ontem', setYesterdayRange]].map(([k, label, fn]) => (
              <button key={k} onClick={fn} style={{
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '6px',
                color: 'var(--color-text-secondary)', padding: '5px 12px', cursor: 'pointer', fontSize: '12px',
              }}>{label}</button>
            ))}
            {[[7,'7 dias'],[14,'14 dias'],[30,'30 dias'],[90,'3 meses']].map(([d, label]) => (
              <button key={d} onClick={() => setQuickRange(d)} style={{
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '6px',
                color: 'var(--color-text-secondary)', padding: '5px 12px', cursor: 'pointer', fontSize: '12px',
              }}>{label}</button>
            ))}
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedConv}
              style={{
                marginLeft: 'auto', background: loading || !selectedConv ? 'var(--color-border-default)' : 'var(--color-brand-600)',
                border: 'none', borderRadius: '8px', color: 'white',
                padding: '10px 24px', cursor: loading || !selectedConv ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {loading
                ? <><i className="fas fa-spinner fa-spin" />Gerando...</>
                : summaryType === 'general'
                  ? <><i className="fas fa-file-alt" />Gerar Resumo Geral</>
                  : <><i className="fas fa-chart-bar" />Gerar Resumo Executivo</>
              }
            </button>
          </div>
        </div>

        {/* ── Resultado ── */}
        {result && summaryType === 'general' && (
          /* ── RESUMO GERAL ─────────────────────────────────────── */
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{result.conversation.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {result.period.start} → {result.period.end}
                  {!result.conversation.wpp_group_id && (
                    <span style={{ marginLeft: '10px', color: '#f59e0b', fontSize: '12px' }}>
                      <i className="fas fa-exclamation-triangle" style={{ marginRight: '4px' }} />
                      Sem WhatsApp vinculado
                    </span>
                  )}
                </div>
              </div>
              {/* Botão Enviar no Grupo */}
              <button
                onClick={handleSendToGroup}
                disabled={sending || !result.conversation.wpp_group_id}
                title={!result.conversation.wpp_group_id ? 'Configure o wpp_group_id na tela de Grupos WhatsApp' : 'Enviar este resumo para o grupo WhatsApp'}
                style={{
                  marginLeft: 'auto',
                  background: sending || !result.conversation.wpp_group_id ? 'var(--color-border-default)' : '#25d366',
                  border: 'none', borderRadius: '10px', color: 'white',
                  padding: '10px 22px', cursor: sending || !result.conversation.wpp_group_id ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'background .15s',
                }}
              >
                {sending
                  ? <><i className="fas fa-spinner fa-spin" />Enviando...</>
                  : <><i className="fab fa-whatsapp" style={{ fontSize: '16px' }} />Enviar no Grupo</>
                }
              </button>
            </div>

            {/* Card de texto editável */}
            <div style={{ background: 'var(--color-bg-card)', borderRadius: '14px', border: '1px solid var(--color-border-default)', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid var(--color-border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  <i className="fas fa-comments" style={{ marginRight: '6px', color: 'var(--color-brand-600)' }}></i>Resumo Geral
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)' }}>
                  <i className="fas fa-edit" style={{ marginRight: '4px' }} />Editável antes de enviar
                </div>
              </div>
              <textarea
                value={editingText !== null ? editingText : (result.general_text || '')}
                onChange={e => setEditingText(e.target.value)}
                rows={18}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--color-text-primary)', fontSize: '14px', lineHeight: 1.75,
                  padding: '18px', resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--color-text-placeholder)', textAlign: 'right' }}>
              {result.conversation.wpp_group_id
                ? <><i className="fas fa-check-circle" style={{ color: '#10b981', marginRight: '4px' }} />Grupo vinculado — pronto para envio</>
                : <><i className="fas fa-info-circle" style={{ marginRight: '4px' }} />Para enviar, vincule este grupo na tela de Grupos WhatsApp</>
              }
            </div>
          </div>
        )}

        {result && summaryType === 'executive' && (
          /* ── RESUMO EXECUTIVO ESTRATÉGICO ─────────────────────── */
          <div>
            {/* Header do resultado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{result.conversation.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {result.period.start} → {result.period.end}
                </div>
              </div>
              <div style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px',
                background: 'var(--color-bg-card)', border: `2px solid ${TEMP_COLORS[result.temperature_label] || 'var(--color-text-secondary)'}`,
                borderRadius: '12px', padding: '10px 18px',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: TEMP_COLORS[result.temperature_label] || 'var(--color-text-secondary)' }}>
                  {result.temperature_score}
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Temperatura</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: TEMP_COLORS[result.temperature_label] }}>
                    {TEMP_LABELS[result.temperature_label] || result.temperature_label}
                  </div>
                </div>
              </div>
            </div>

            {/* KPIs */}
            {result.stats.total_messages > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                <StatBox label="Mensagens"   value={result.stats.total_messages}      icon="comment"         />
                <StatBox label="Participantes" value={result.stats.unique_participants} icon="users"          />
                <StatBox label="Risco Médio" value={`${result.stats.avg_risk_score}/100`} icon="exclamation-triangle" color={result.stats.avg_risk_score >= 60 ? '#ef4444' : result.stats.avg_risk_score >= 30 ? '#f59e0b' : '#10b981'} />
                {result.stats.churn_risk_count > 0 && <StatBox label="Churn"  value={result.stats.churn_risk_count}    icon="user-minus"    color="#ef4444" />}
                {result.stats.escalation_count > 0 && <StatBox label="Escaladas" value={result.stats.escalation_count} icon="fire"          color="#f59e0b" />}
                {result.stats.opportunity_count > 0 && <StatBox label="Oportunidades" value={result.stats.opportunity_count} icon="lightbulb" color="#10b981" />}
                {result.stats.complaint_count > 0 && <StatBox label="Reclamações"  value={result.stats.complaint_count} icon="thumbs-down"  color="#f97316" />}
                {result.stats.critical_alerts > 0 && <StatBox label="Alertas Críticos" value={result.stats.critical_alerts} icon="bell"     color="#ef4444" />}
              </div>
            )}

            {/* Grid: texto + tags */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: '16px', marginBottom: '20px' }}>

              {/* Texto executivo */}
              <div style={{ background: 'var(--color-bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border-default)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' }}>
                  <i className="fas fa-file-alt" style={{ marginRight: '6px' }}></i>Análise Executiva
                </div>
                <div
                  style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: renderMd(result.executive_text) }}
                />
              </div>

              {/* Distribuição de tags */}
              {Object.keys(result.tag_distribution || {}).length > 0 && (
                <div style={{ background: 'var(--color-bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border-default)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' }}>
                    <i className="fas fa-tags" style={{ marginRight: '6px' }}></i>Tags Detectadas
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(result.tag_distribution).map(([tag, count]) => {
                      const max = Math.max(...Object.values(result.tag_distribution));
                      const pct = (count / max * 100).toFixed(0);
                      const TAG_COLORS = {
                        risco_churn: '#ef4444', urgencia_critica: '#ef4444', escalada_emocional: '#f97316',
                        reclamacao: '#f59e0b', followup_necessario: '#3b82f6', oportunidade_comercial: '#10b981',
                        promessa_detectada: '#8b5cf6', atrito_interno: '#ec4899', urgencia_alta: '#f97316',
                      };
                      const color = TAG_COLORS[tag] || 'var(--color-text-muted)';
                      return (
                        <div key={tag}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                            <span style={{ color: 'var(--color-text-primary)' }}>{tag.replace(/_/g, ' ')}</span>
                            <span style={{ color: 'var(--color-text-muted)' }}>{count}x</span>
                          </div>
                          <div style={{ height: '5px', background: 'var(--color-border-default)', borderRadius: '3px' }}>
                            <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: '3px', transition: 'width 0.4s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Mensagens de destaque */}
            {result.top_messages?.length > 0 && (
              <div style={{ background: 'var(--color-bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border-default)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i>Mensagens de Maior Risco
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {result.top_messages.map((m, i) => (
                    <div key={m.id || i} style={{ background: 'var(--color-bg-card)', borderRadius: '8px', padding: '12px 14px', borderLeft: `3px solid ${m.risk_score >= 70 ? '#ef4444' : m.risk_score >= 40 ? '#f59e0b' : 'var(--color-text-muted)'}` }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{m.sent_at ? new Date(m.sent_at).toLocaleString('pt-BR') : ''}</span>
                        <span style={{ fontSize: '11px', background: m.risk_score >= 70 ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)', color: m.risk_score >= 70 ? '#ef4444' : 'var(--color-text-secondary)', padding: '1px 7px', borderRadius: '999px' }}>
                          Risco {m.risk_score}/100
                        </span>
                        {(m.tags || []).slice(0, 3).map(t => (
                          <span key={t} style={{ fontSize: '10px', background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', padding: '1px 7px', borderRadius: '999px', border: '1px solid var(--color-border-default)' }}>{t.replace(/_/g,' ')}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{m.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div style={{ textAlign: 'center', paddingTop: '60px', color: 'var(--color-text-muted)' }}>
            <i className={`fas fa-${summaryType === 'general' ? 'comments' : 'chart-line'}`} style={{ fontSize: '40px', display: 'block', marginBottom: '16px', color: 'var(--color-text-primary)' }}></i>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-placeholder)', marginBottom: '8px' }}>Selecione um grupo e um período</div>
            <div style={{ fontSize: '14px' }}>
              {summaryType === 'general'
                ? 'O Resumo Geral será gerado como uma ata de reunião, pronto para envio no grupo.'
                : 'O Resumo Executivo será gerado com estatísticas, tags e análise estratégica.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CustomAnalysisScreen — Análise Personalizada (D-036)
// Usuário seleciona 1+ grupos, um período, e escreve livremente
// a análise que deseja — sem se limitar aos formatos fixos do
// "Resumo por Período". A IA também pode sugerir perguntas.
// ─────────────────────────────────────────────────────────────
const CUSTOM_ANALYSIS_DEFAULT_SUGGESTIONS = [
  'Quais clientes estão com risco de cancelar e por quê?',
  'Resuma as principais reclamações e sugira como resolvê-las',
  'Quais oportunidades comerciais surgiram nesse período?',
  'Como está o sentimento geral dos clientes ao longo do período?',
  'Liste os pontos de atenção que o gestor deveria revisar hoje',
  'Escreva um resumo executivo em 3 parágrafos para a diretoria',
];

function CustomAnalysisScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [conversations,  setConversations]  = React.useState([]);
  const [convSearch,     setConvSearch]     = React.useState('');
  const [selectedIds,    setSelectedIds]    = React.useState([]);
  const [startDate,      setStartDate]      = React.useState(weekAgo);
  const [endDate,        setEndDate]        = React.useState(today);
  const [question,       setQuestion]       = React.useState('');
  const [loading,        setLoading]        = React.useState(false);
  const [loadingConvs,   setLoadingConvs]   = React.useState(false);
  const [suggesting,     setSuggesting]     = React.useState(false);
  const [aiSuggestions,  setAiSuggestions]  = React.useState([]);
  const [result,         setResult]         = React.useState(null);
  const [showConvList,   setShowConvList]   = React.useState(false);

  const [activeTab,      setActiveTab]      = React.useState('new'); // 'new' | 'history'
  const [history,        setHistory]        = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [historyDetail,  setHistoryDetail]  = React.useState(null);
  const [loadingDetail,  setLoadingDetail]  = React.useState(false);

  const isMobile = useIsMobile();

  React.useEffect(() => {
    setLoadingConvs(true);
    window.apiGet('/conversations?limit=200')
      .then(d => setConversations(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingConvs(false));
  }, []);

  function loadHistory() {
    setLoadingHistory(true);
    window.apiGet('/analysis/custom/history?limit=50')
      .then(d => setHistory(Array.isArray(d.items) ? d.items : []))
      .catch(() => window.showToast('Erro ao carregar histórico.', 'error'))
      .finally(() => setLoadingHistory(false));
  }

  React.useEffect(() => {
    if (activeTab === 'history') { setHistoryDetail(null); loadHistory(); }
  }, [activeTab]);

  function openHistoryItem(id) {
    setLoadingDetail(true);
    setHistoryDetail(null);
    window.apiGet(`/analysis/custom/history/${id}`)
      .then(d => setHistoryDetail(d))
      .catch(() => window.showToast('Erro ao carregar análise.', 'error'))
      .finally(() => setLoadingDetail(false));
  }

  async function deleteHistoryItem(id, e) {
    e.stopPropagation();
    if (!window.confirm('Excluir esta análise do histórico?')) return;
    try {
      await window.apiDelete(`/analysis/custom/history/${id}`);
      setHistory(prev => prev.filter(h => h.id !== id));
      if (historyDetail?.id === id) setHistoryDetail(null);
      window.showToast('Análise excluída.', 'success');
    } catch (e2) {
      window.showToast('Erro ao excluir análise.', 'error');
    }
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const filteredConvs = conversations.filter(c =>
    !convSearch || c.name.toLowerCase().includes(convSearch.toLowerCase())
  );
  const selectedConvs = conversations.filter(c => selectedIds.includes(c.id));

  function toggleConv(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function setQuickRange(days) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  }

  function setTodayRange() {
    const d = new Date().toISOString().slice(0, 10);
    setStartDate(d); setEndDate(d);
  }

  function setYesterdayRange() {
    const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    setStartDate(d); setEndDate(d);
  }

  async function handleSuggestWithAI() {
    setSuggesting(true);
    try {
      const data = await window.apiPost('/analysis/suggestions', {
        conversation_ids: selectedIds,
        start_date: startDate,
        end_date: endDate,
      });
      const list = Array.isArray(data.suggestions) ? data.suggestions : [];
      if (list.length === 0) {
        window.showToast('Não foi possível gerar sugestões agora. Tente as sugestões padrão.', 'warning');
      }
      setAiSuggestions(list);
    } catch (e) {
      window.showToast('Erro ao sugerir análises. Tente novamente.', 'error');
    } finally {
      setSuggesting(false);
    }
  }

  async function handleGenerate() {
    if (selectedIds.length === 0) { window.showToast('Selecione ao menos um grupo.', 'warning'); return; }
    if (!question.trim()) { window.showToast('Descreva a análise que você deseja.', 'warning'); return; }
    if (!startDate || !endDate) { window.showToast('Informe o período.', 'warning'); return; }
    if (startDate > endDate) { window.showToast('Data inicial deve ser anterior à final.', 'warning'); return; }

    setLoading(true);
    setResult(null);
    try {
      const data = await window.apiPost('/analysis/custom', {
        conversation_ids: selectedIds,
        question: question.trim(),
        start_date: startDate,
        end_date: endDate,
      });
      setResult(data);
    } catch (e) {
      window.showToast(e.message || 'Erro ao gerar análise. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const suggestionChips = aiSuggestions.length > 0 ? aiSuggestions : CUSTOM_ANALYSIS_DEFAULT_SUGGESTIONS;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="Análise Personalizada" subtitle="Peça qualquer análise sobre um ou mais grupos, no período que quiser" />

      {/* ── Abas ── */}
      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--color-border-default)' }}>
        {[['new', 'Nova Análise', 'wand-magic-sparkles'], ['history', 'Histórico de Análises', 'clock-rotate-left']].map(([id, label, icon]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: activeTab === id ? '#2dd4bf' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600,
            padding: '10px 16px', borderBottom: activeTab === id ? '2px solid var(--color-brand-600)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <i className={`fas fa-${icon}`} />{label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>

        {activeTab === 'history' ? (
          <div style={{ paddingTop: '20px' }}>
            {historyDetail ? (
              <div>
                <button onClick={() => setHistoryDetail(null)} style={{
                  background: 'transparent', border: '1px solid var(--color-border-default)', borderRadius: '6px',
                  color: 'var(--color-text-secondary)', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <i className="fas fa-arrow-left" />Voltar ao histórico
                </button>

                <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px' }}>Detalhes da Análise</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Data/hora realizada: </span><span style={{ color: 'var(--color-text-primary)' }}>{formatDateTime(historyDetail.created_at)}</span></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Período analisado: </span><span style={{ color: 'var(--color-text-primary)' }}>{historyDetail.period.start} → {historyDetail.period.end}</span></div>
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--color-text-muted)' }}>Grupos analisados: </span><span style={{ color: 'var(--color-text-primary)' }}>{(historyDetail.groups_stats || []).map(g => g.name).join(', ') || '—'}</span></div>
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--color-text-muted)' }}>Descrição/pergunta utilizada: </span><span style={{ color: 'var(--color-text-primary)', fontStyle: 'italic' }}>"{historyDetail.question}"</span></div>
                  </div>
                </div>

                {historyDetail.groups_stats?.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                    {historyDetail.groups_stats.map(g => (
                      <div key={g.id} style={{ background: 'var(--color-bg-card)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--color-border-default)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>{g.name}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                          <span style={{ background: 'var(--color-bg-card)', borderRadius: '6px', padding: '3px 8px', color: 'var(--color-text-secondary)' }}>
                            <i className="fas fa-comment" style={{ marginRight: '4px' }} />{g.stats.total_messages} msgs
                          </span>
                          <span style={{
                            background: 'var(--color-bg-card)', borderRadius: '6px', padding: '3px 8px',
                            color: g.stats.avg_risk_score >= 60 ? '#ef4444' : g.stats.avg_risk_score >= 30 ? '#f59e0b' : '#10b981',
                          }}>
                            <i className="fas fa-exclamation-triangle" style={{ marginRight: '4px' }} />{g.stats.avg_risk_score}/100
                          </span>
                          {g.stats.churn_risk_count > 0 && (
                            <span style={{ background: 'var(--color-bg-card)', borderRadius: '6px', padding: '3px 8px', color: '#ef4444' }}>
                              <i className="fas fa-user-minus" style={{ marginRight: '4px' }} />{g.stats.churn_risk_count} churn
                            </span>
                          )}
                          {g.stats.opportunity_count > 0 && (
                            <span style={{ background: 'var(--color-bg-card)', borderRadius: '6px', padding: '3px 8px', color: '#10b981' }}>
                              <i className="fas fa-lightbulb" style={{ marginRight: '4px' }} />{g.stats.opportunity_count} oport.
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ background: 'var(--color-bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border-default)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' }}>
                    <i className="fas fa-sparkles" style={{ marginRight: '6px' }}></i>Resposta Gerada
                  </div>
                  <div
                    style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-primary)' }}
                    dangerouslySetInnerHTML={{ __html: renderMd(historyDetail.answer_text) }}
                  />
                </div>
              </div>
            ) : loadingDetail ? (
              <SectionLoader padding="60px 0" />
            ) : loadingHistory ? (
              <SectionLoader label="Carregando histórico..." padding="60px 0" />
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: '60px', color: 'var(--color-text-muted)' }}>
                <i className="fas fa-clock-rotate-left" style={{ fontSize: '40px', display: 'block', marginBottom: '16px', color: 'var(--color-text-primary)' }}></i>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-placeholder)', marginBottom: '8px' }}>Nenhuma análise salva ainda</div>
                <div style={{ fontSize: '14px' }}>Toda análise gerada na aba "Nova Análise" fica salva aqui automaticamente.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map(h => (
                  <div key={h.id} onClick={() => openHistoryItem(h.id)} style={{
                    background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '10px',
                    padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: '12px',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover-sidebar)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-card)'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                        {formatDateTime(h.created_at)} · {h.start_date} → {h.end_date} · {h.total_messages} msgs
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontStyle: 'italic', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        "{h.question}"
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        <i className="fas fa-users" style={{ marginRight: '6px' }} />{h.group_names.join(', ') || '—'}
                      </div>
                    </div>
                    <button onClick={(e) => deleteHistoryItem(h.id, e)} title="Excluir" style={{
                      background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', flexShrink: 0,
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <React.Fragment>

        {/* ── Formulário ── */}
        <div style={{
          background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '14px',
          padding: '20px', marginBottom: '24px',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px',
        }}>

          {/* Seleção de grupos (múltipla) */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-users" style={{ marginRight: '6px' }}></i>Grupo(s) / Conversa(s)
            </label>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowConvList(v => !v)}
                style={{
                  background: 'var(--color-bg-card)', border: `1px solid ${showConvList ? 'var(--color-brand-600)' : 'var(--color-border-input)'}`,
                  borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                  color: selectedIds.length ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontSize: '14px', minHeight: '20px',
                }}
              >
                {selectedIds.length === 0 ? (
                  <span>Selecionar grupo(s)...</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedConvs.map(c => (
                      <span key={c.id} style={{
                        background: 'rgba(13,148,136,0.15)', color: '#2dd4bf', border: '1px solid rgba(13,148,136,0.4)',
                        borderRadius: '999px', padding: '2px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        {c.name}
                        <i className="fas fa-times" style={{ cursor: 'pointer', fontSize: '10px' }}
                          onClick={e => { e.stopPropagation(); toggleConv(c.id); }} />
                      </span>
                    ))}
                  </div>
                )}
                <i className={`fas fa-chevron-${showConvList ? 'up' : 'down'}`} style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }} />
              </div>
              {showConvList && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden', marginTop: '4px',
                }}>
                  <div style={{ padding: '8px' }}>
                    <input
                      autoFocus
                      value={convSearch}
                      onChange={e => setConvSearch(e.target.value)}
                      placeholder="Buscar..."
                      style={{
                        width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                        borderRadius: '6px', color: 'var(--color-text-primary)', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {loadingConvs ? (
                      <div style={{ padding: '16px', textAlign: 'center' }}><LoadingDots size={4} /></div>
                    ) : filteredConvs.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Nenhum grupo encontrado.</div>
                    ) : filteredConvs.map(c => {
                      const checked = selectedIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleConv(c.id)}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                            color: checked ? '#2dd4bf' : 'var(--color-text-primary)',
                            background: checked ? 'rgba(13,148,136,0.1)' : 'transparent',
                            display: 'flex', alignItems: 'center', gap: '10px',
                          }}
                          onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--color-border-default)'; }}
                          onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <i className={`fas fa-${checked ? 'check-square' : 'square'}`} style={{ color: checked ? 'var(--color-brand-600)' : 'var(--color-text-placeholder)', fontSize: '13px' }} />
                          {c.name}
                        </div>
                      );
                    })}
                  </div>
                  {filteredConvs.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--color-border-default)', padding: '8px 14px', display: 'flex', justifyContent: 'space-between' }}>
                      <button onClick={() => setSelectedIds(filteredConvs.map(c => c.id))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-brand-600)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                        Selecionar todos
                      </button>
                      <button onClick={() => setSelectedIds([])}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                        Limpar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Data início */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>Data Inicial
            </label>
            <input
              type="date" value={startDate} max={endDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Data fim */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-calendar-check" style={{ marginRight: '6px' }}></i>Data Final
            </label>
            <input
              type="date" value={endDate} min={startDate} max={today}
              onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Atalhos de período */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Atalhos:</span>
            {[['hoje', 'Hoje', setTodayRange], ['ontem', 'Ontem', setYesterdayRange]].map(([k, label, fn]) => (
              <button key={k} onClick={fn} style={{
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '6px',
                color: 'var(--color-text-secondary)', padding: '5px 12px', cursor: 'pointer', fontSize: '12px',
              }}>{label}</button>
            ))}
            {[[7,'7 dias'],[14,'14 dias'],[30,'30 dias'],[90,'3 meses']].map(([d, label]) => (
              <button key={d} onClick={() => setQuickRange(d)} style={{
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '6px',
                color: 'var(--color-text-secondary)', padding: '5px 12px', cursor: 'pointer', fontSize: '12px',
              }}>{label}</button>
            ))}
          </div>

          {/* Pergunta livre + sugestões */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                <i className="fas fa-comment-dots" style={{ marginRight: '6px' }}></i>O que você quer saber?
              </label>
              <button
                onClick={handleSuggestWithAI}
                disabled={suggesting}
                style={{
                  background: 'transparent', border: '1px solid var(--color-border-input)', borderRadius: '6px',
                  color: suggesting ? 'var(--color-text-placeholder)' : '#a78bfa', padding: '4px 10px', cursor: suggesting ? 'not-allowed' : 'pointer',
                  fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {suggesting
                  ? <><LoadingDots size={4} color="currentColor" />Pensando...</>
                  : <><i className="fas fa-wand-magic-sparkles" />Sugerir com IA</>
                }
              </button>
            </div>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={3}
              placeholder='Ex: "Quais clientes estão insatisfeitos e por quê?" ou "Faça um raio-x comercial desse grupo no período"'
              style={{
                width: '100%', boxSizing: 'border-box', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)',
                borderRadius: '8px', color: 'var(--color-text-primary)', padding: '10px 12px', fontSize: '14px',
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              {suggestionChips.map((s, i) => (
                <button key={i} onClick={() => setQuestion(s)} title={s} style={{
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '999px',
                  color: 'var(--color-text-secondary)', padding: '5px 12px', cursor: 'pointer', fontSize: '11px',
                  maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Botão gerar */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleGenerate}
              disabled={loading || selectedIds.length === 0 || !question.trim()}
              style={{
                background: loading || selectedIds.length === 0 || !question.trim() ? 'var(--color-border-default)' : 'var(--color-brand-600)',
                border: 'none', borderRadius: '8px', color: 'white',
                padding: '10px 24px', cursor: loading || selectedIds.length === 0 || !question.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {loading
                ? <><i className="fas fa-spinner fa-spin" />Gerando...</>
                : <><i className="fas fa-magic" />Gerar Análise</>
              }
            </button>
          </div>
        </div>

        {/* ── Resultado ── */}
        {result && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                {result.period.start} → {result.period.end} · {result.groups_stats?.length || 0} grupo(s)
              </div>
              <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>"{result.question}"</div>
            </div>

            {/* Stats por grupo */}
            {result.groups_stats?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {result.groups_stats.map(g => (
                  <div key={g.id} style={{ background: 'var(--color-bg-card)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--color-border-default)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>{g.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                      <span style={{ background: 'var(--color-bg-card)', borderRadius: '6px', padding: '3px 8px', color: 'var(--color-text-secondary)' }}>
                        <i className="fas fa-comment" style={{ marginRight: '4px' }} />{g.stats.total_messages} msgs
                      </span>
                      <span style={{
                        background: 'var(--color-bg-card)', borderRadius: '6px', padding: '3px 8px',
                        color: g.stats.avg_risk_score >= 60 ? '#ef4444' : g.stats.avg_risk_score >= 30 ? '#f59e0b' : '#10b981',
                      }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: '4px' }} />{g.stats.avg_risk_score}/100
                      </span>
                      {g.stats.churn_risk_count > 0 && (
                        <span style={{ background: 'var(--color-bg-card)', borderRadius: '6px', padding: '3px 8px', color: '#ef4444' }}>
                          <i className="fas fa-user-minus" style={{ marginRight: '4px' }} />{g.stats.churn_risk_count} churn
                        </span>
                      )}
                      {g.stats.opportunity_count > 0 && (
                        <span style={{ background: 'var(--color-bg-card)', borderRadius: '6px', padding: '3px 8px', color: '#10b981' }}>
                          <i className="fas fa-lightbulb" style={{ marginRight: '4px' }} />{g.stats.opportunity_count} oport.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resposta da IA */}
            <div style={{ background: 'var(--color-bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border-default)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' }}>
                <i className="fas fa-sparkles" style={{ marginRight: '6px' }}></i>Resultado da Análise
              </div>
              <div
                style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-primary)' }}
                dangerouslySetInnerHTML={{ __html: renderMd(result.answer_text) }}
              />
            </div>
          </div>
        )}

        {!result && !loading && (
          <div style={{ textAlign: 'center', paddingTop: '60px', color: 'var(--color-text-muted)' }}>
            <i className="fas fa-wand-magic-sparkles" style={{ fontSize: '40px', display: 'block', marginBottom: '16px', color: 'var(--color-text-primary)' }}></i>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-placeholder)', marginBottom: '8px' }}>Peça qualquer análise sobre seus grupos</div>
            <div style={{ fontSize: '14px' }}>
              Selecione um ou mais grupos, um período e escreva o que você quer saber — a IA responde com base nas conversas reais.
            </div>
          </div>
        )}
        </React.Fragment>
        )}
      </div>
    </div>
  );
}

// renderMd helper simples (compatível com os outros screens)
function renderMd(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^>\s(.+)$/gm, '<blockquote style="border-left:3px solid var(--color-brand-600);margin:8px 0;padding:8px 12px;background:rgba(13,148,136,0.08);color:var(--color-text-secondary);border-radius:0 6px 6px 0">$1</blockquote>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;color:var(--color-text-primary);margin:12px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;color:var(--color-text-primary);margin:14px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:16px;color:var(--color-text-primary);margin:14px 0 8px">$1</h1>')
    .replace(/\n/g, '<br>');
}

// ─────────────────────────────────────────────────────────────
// ExprCard — card de expressão do agente (fora do AgentConfigScreen
// para evitar remount em cada re-render do pai e preservar inputRef)
// ─────────────────────────────────────────────────────────────
function ExprCard({ expr, uploadingExpr, onUpload, onRemoveImage, onRemove, onChangeField }) {
  const inputRef = React.useRef();
  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => { setImgError(false); }, [expr.image_url]);
  const busy = uploadingExpr[expr.type];
  const showImg = expr.image_url && !imgError;
  return (
    <div style={{
      background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '12px',
      padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center',
      position: 'relative',
    }}>
      {/* Botão deletar expressão */}
      <button onClick={() => onRemove(expr.type)} title="Remover expressão"
        style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px',
          background: 'var(--color-border-default)', border: 'none', borderRadius: '50%', color: 'var(--color-text-secondary)',
          cursor: 'pointer', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--color-border-default)'}>
        <i className="fas fa-trash" />
      </button>

      {/* Imagem ou emoji */}
      <div style={{ position: 'relative', width: '72px', height: '72px' }}>
        {showImg ? (
          <img src={expr.image_url} alt={expr.label}
            onError={() => setImgError(true)}
            style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-brand-600)' }} />
        ) : (
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%', background: 'var(--color-bg-card)',
            border: '2px dashed var(--color-border-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
          }}>{expr.emoji}</div>
        )}
        {showImg && (
          <button onClick={() => onRemoveImage(expr.type)}
            style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px',
              background: '#ef4444', border: 'none', borderRadius: '50%', color: 'white',
              cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        )}
      </div>

      {/* Label editável */}
      <input
        value={expr.label}
        onChange={e => onChangeField(expr.type, 'label', e.target.value)}
        maxLength={30}
        style={{
          width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '6px',
          color: 'var(--color-text-primary)', padding: '5px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600,
          boxSizing: 'border-box',
        }}
        placeholder="Rótulo"
      />

      {/* Emoji padrão (usado quando não há imagem) */}
      <input
        value={expr.emoji}
        onChange={e => onChangeField(expr.type, 'emoji', e.target.value.slice(-2))}
        maxLength={2}
        style={{
          width: '52px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '8px',
          color: 'var(--color-text-primary)', padding: '6px', textAlign: 'center', fontSize: '20px',
        }}
        title="Emoji padrão (quando sem imagem)"
      />

      {/* Upload de imagem da expressão */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/*"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) onUpload(expr.type, e.target.files[0]); e.target.value = ''; }}
      />
      <button
        onClick={() => inputRef.current && inputRef.current.click()}
        disabled={busy}
        style={{
          background: busy ? 'var(--color-brand-600)' : 'var(--color-bg-card)',
          border: '1px solid ' + (busy ? 'var(--color-brand-600)' : 'var(--color-border-input)'),
          borderRadius: '8px', color: busy ? 'white' : 'var(--color-text-secondary)',
          padding: '5px 10px', cursor: busy ? 'wait' : 'pointer',
          fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px',
          transition: 'all 0.15s',
        }}>
        {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-image" />}
        {busy ? 'Enviando...' : showImg ? 'Trocar imagem' : 'Adicionar foto'}
      </button>
      {!showImg && (
        <div style={{ fontSize: '10px', color: 'var(--color-text-placeholder)', textAlign: 'center', lineHeight: 1.3 }}>
          PNG, JPG, GIF, WebP<br/>Sticker do WhatsApp (.webp)
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AgentConfigScreen — Configuração do Agente Virtual
// ─────────────────────────────────────────────────────────────
function AgentConfigScreen() {
  const TONES = [
    { value: 'formal',        label: 'Formal',        desc: 'Linguagem técnica e impessoal' },
    { value: 'profissional',  label: 'Profissional',  desc: 'Objetivo e respeitoso' },
    { value: 'amigavel',      label: 'Amigável',      desc: 'Próximo e acessível' },
    { value: 'casual',        label: 'Casual',        desc: 'Direto e descontraído' },
  ];
  const EXPR_DEFAULTS = [
    { type: 'neutral',  label: 'Neutro',     emoji: '🤖', desc: 'Estado padrão' },
    { type: 'positive', label: 'Positivo',   emoji: '✅', desc: 'Boas notícias / oportunidades' },
    { type: 'alert',    label: 'Em Alerta',  emoji: '⚠️', desc: 'Situações de atenção' },
    { type: 'critical', label: 'Crítico',    emoji: '🚨', desc: 'Urgências e churn' },
    { type: 'thinking', label: 'Analisando', emoji: '🧠', desc: 'Processando dados' },
  ];

  const [cfg,        setCfg]        = React.useState(null);
  const [loading,    setLoading]    = React.useState(true);
  const [saving,     setSaving]     = React.useState(false);
  const [name,       setName]       = React.useState('Agente ENVOX');
  const [roleLabel,  setRoleLabel]  = React.useState('');
  const [personality,setPersonality]= React.useState('');
  const [tone,       setTone]       = React.useState('profissional');
  const [signature,  setSignature]  = React.useState('');
  const [avatarUrl,  setAvatarUrl]  = React.useState(null);
  const [expressions,setExpressions]= React.useState(EXPR_DEFAULTS.map(e => ({ ...e, image_url: null })));
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [uploadingExpr, setUploadingExpr] = React.useState({});
  const [newExprForm, setNewExprForm]     = React.useState({ open: false, label: '', emoji: '😊' });
  const isMobile = useIsMobile();

  React.useEffect(() => {
    window.apiGet('/agent/config')
      .then(d => {
        setCfg(d);
        setName(d.name || 'Agente ENVOX');
        setRoleLabel(d.role_label || '');
        setPersonality(d.personality || '');
        setTone(d.tone || 'profissional');
        setSignature(d.signature || '');
        setAvatarUrl(d.avatar_url || null);
        if (d.expressions?.length) {
          setExpressions(d.expressions.map(e => ({
            type: e.type,
            label: e.label || e.type,
            emoji: e.emoji || '🤖',
            image_url: e.image_url || null,
            desc: EXPR_DEFAULTS.find(def => def.type === e.type)?.desc || '',
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch('/api/v1/agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + window.getToken() },
        body: JSON.stringify({
          name, role_label: roleLabel, personality, tone, signature,
          expressions: expressions.map(e => ({ type: e.type, label: e.label, emoji: e.emoji })),
        }),
      });
      if (!r.ok) { window.showToast('Erro ao salvar agente.', 'error'); return; }
      window.showToast('Agente salvo com sucesso!', 'success');
    } catch { window.showToast('Erro ao salvar.', 'error'); }
    finally { setSaving(false); }
  }

  async function handleAvatarUpload(file) {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/v1/agent/avatar', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + window.getToken() },
        body: fd,
      });
      if (!r.ok) { window.showToast('Erro ao enviar avatar.', 'error'); return; }
      const d = await r.json();
      setAvatarUrl(d.avatar_url);
      window.showToast('Avatar atualizado!', 'success');
    } catch { window.showToast('Erro ao enviar imagem.', 'error'); }
    finally { setUploadingAvatar(false); }
  }

  async function handleRemoveAvatar() {
    await fetch('/api/v1/agent/avatar', { method: 'DELETE', headers: { Authorization: 'Bearer ' + window.getToken() } });
    setAvatarUrl(null);
    window.showToast('Avatar removido.', 'info');
  }

  async function handleExprUpload(type, file) {
    if (!file) return;
    setUploadingExpr(prev => ({ ...prev, [type]: true }));
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`/api/v1/agent/expression/${type}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + window.getToken() },
        body: fd,
      });
      if (!r.ok) {
        let msg = 'Erro ao enviar imagem.';
        try { const err = await r.json(); msg = err.detail || msg; } catch {}
        window.showToast(msg, 'error');
        return;
      }
      const d = await r.json();
      setExpressions(prev => prev.map(e => e.type === type ? { ...e, image_url: d.image_url } : e));
      window.showToast('Expressão atualizada!', 'success');
    } catch (e) { window.showToast('Erro de rede: ' + e.message, 'error'); }
    finally { setUploadingExpr(prev => ({ ...prev, [type]: false })); }
  }

  async function handleExprRemove(type) {
    await fetch(`/api/v1/agent/expression/${type}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + window.getToken() } });
    setExpressions(prev => prev.map(e => e.type === type ? { ...e, image_url: null } : e));
  }

  function removeExpression(type) {
    setExpressions(prev => prev.filter(e => e.type !== type));
  }

  function addExpression() {
    const label = newExprForm.label.trim();
    if (!label) return;
    const slug = label.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'expr';
    const type = `c_${slug}_${Date.now().toString(36)}`;
    setExpressions(prev => [...prev, { type, label, emoji: newExprForm.emoji || '🤖', image_url: null, desc: '' }]);
    setNewExprForm({ open: false, label: '', emoji: '😊' });
  }

  // Preview de como ficará a mensagem
  const previewExpr = expressions.find(e => e.type === 'alert') || expressions[0];
  const previewEmoji = previewExpr?.emoji || '⚠️';
  const previewName = name || 'Agente ENVOX';
  const previewRole = roleLabel ? ` — ${roleLabel}` : '';
  const previewSig = signature ? `\n_${signature}_` : '';
  const previewMsg = `${previewEmoji} *${previewName}${previewRole}*\n━━━━━━━━━━━━━━━━━\n_Aqui virá o conteúdo do resumo gerado automaticamente..._\n━━━━━━━━━━━━━━━━━\n📝 _Gerado por ${previewName} · ATENX_${previewSig}`;

  const S = { // shared styles
    label: { display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: '6px' },
    input: { width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' },
    card: { background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: '14px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    sectionTitle: { fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' },
  };

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SectionLoader label="Carregando configurações..." />
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Configuração do Agente"
        subtitle="Defina identidade, personalidade e expressões do agente automático"
        actions={
          <button onClick={handleSave} disabled={saving} style={{
            background: saving ? 'var(--color-border-default)' : 'var(--color-brand-600)', border: 'none', borderRadius: '8px',
            color: 'white', padding: '8px 20px', cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {saving ? <><i className="fas fa-spinner fa-spin" />Salvando...</> : <><i className="fas fa-save" />Salvar</>}
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: '20px', maxWidth: '1100px' }}>

          {/* Coluna esquerda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Identidade ── */}
            <div style={S.card}>
              <div style={S.sectionTitle}><i className="fas fa-id-badge" style={{ color: 'var(--color-brand-600)' }} />Identidade do Agente</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={S.label}>Nome do Agente *</label>
                  <input value={name} onChange={e => setName(e.target.value)} style={S.input} placeholder="ex: EVA, ARIA, Max..." />
                </div>
                <div>
                  <label style={S.label}>Cargo / Papel</label>
                  <input value={roleLabel} onChange={e => setRoleLabel(e.target.value)} style={S.input} placeholder="ex: Analista de CRM" />
                </div>
              </div>

              <div>
                <label style={S.label}>Personalidade <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(usado nos prompts de IA)</span></label>
                <textarea value={personality} onChange={e => setPersonality(e.target.value)}
                  rows={4} style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }}
                  placeholder="Ex: Sou analítico, objetivo e empático. Priorizo clareza nas informações e destaco pontos críticos com urgência adequada. Evito linguagem técnica desnecessária." />
              </div>

              <div>
                <label style={S.label}>Tom de Comunicação</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {TONES.map(t => (
                    <div key={t.value} onClick={() => setTone(t.value)} style={{
                      border: `2px solid ${tone === t.value ? 'var(--color-brand-600)' : 'var(--color-border-default)'}`,
                      background: tone === t.value ? 'rgba(13,148,136,0.12)' : 'var(--color-bg-card)',
                      borderRadius: '10px', padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: tone === t.value ? 'var(--color-brand-600)' : 'var(--color-text-primary)' }}>{t.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px' }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={S.label}>Assinatura <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(texto no rodapé das mensagens automáticas)</span></label>
                <input value={signature} onChange={e => setSignature(e.target.value)} style={S.input}
                  placeholder="ex: Este relatório foi gerado automaticamente. Dúvidas? Contate seu gestor." />
              </div>
            </div>

            {/* ── Expressões ── */}
            <div style={S.card}>
              <div>
                <div style={S.sectionTitle}><i className="fas fa-theater-masks" style={{ color: 'var(--color-brand-600)' }} />Expressões</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Crie, edite e remova expressões. Alterações são salvas pelo botão <strong style={{ color: 'var(--color-text-secondary)' }}>Salvar</strong> no topo.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                {expressions.map(expr => (
                  <ExprCard
                    key={expr.type}
                    expr={expr}
                    uploadingExpr={uploadingExpr}
                    onUpload={handleExprUpload}
                    onRemoveImage={handleExprRemove}
                    onRemove={removeExpression}
                    onChangeField={(type, field, value) =>
                      setExpressions(prev => prev.map(x => x.type === type ? { ...x, [field]: value } : x))
                    }
                  />
                ))}
              </div>
              {/* Nova expressão */}
              {newExprForm.open ? (
                <div style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border-input)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Nova Expressão</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input value={newExprForm.emoji}
                      onChange={e => setNewExprForm(f => ({ ...f, emoji: e.target.value.slice(-2) }))}
                      maxLength={2}
                      style={{ width: '48px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '6px', textAlign: 'center', fontSize: '18px' }}
                      placeholder="😊" />
                    <input value={newExprForm.label}
                      onChange={e => setNewExprForm(f => ({ ...f, label: e.target.value }))}
                      maxLength={30}
                      onKeyDown={e => e.key === 'Enter' && addExpression()}
                      style={{ flex: 1, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-input)', borderRadius: '8px', color: 'var(--color-text-primary)', padding: '7px 10px', fontSize: '13px' }}
                      placeholder="Nome da expressão (ex: Animado)"
                      autoFocus />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setNewExprForm({ open: false, label: '', emoji: '😊' })}
                      style={{ background: 'transparent', border: '1px solid var(--color-border-input)', borderRadius: '8px', color: 'var(--color-text-secondary)', padding: '5px 12px', cursor: 'pointer', fontSize: '12px' }}>
                      Cancelar
                    </button>
                    <button onClick={addExpression} disabled={!newExprForm.label.trim()}
                      style={{ background: newExprForm.label.trim() ? 'var(--color-brand-600)' : 'var(--color-border-default)', border: 'none', borderRadius: '8px', color: 'white', padding: '5px 12px', cursor: newExprForm.label.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600 }}>
                      Adicionar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setNewExprForm(f => ({ ...f, open: true }))}
                  style={{ background: 'transparent', border: '1px dashed var(--color-border-input)', borderRadius: '10px', color: 'var(--color-text-muted)', padding: '10px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', transition: 'border-color 0.15s' }}>
                  <i className="fas fa-plus" /> Nova Expressão
                </button>
              )}
            </div>
          </div>

          {/* Coluna direita */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Avatar ── */}
            <div style={{ ...S.card, alignItems: 'center' }}>
              <div style={S.sectionTitle}><i className="fas fa-user-circle" style={{ color: 'var(--color-brand-600)' }} />Avatar</div>

              {/* Círculo de avatar */}
              <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar"
                    style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-brand-600)' }} />
                ) : (
                  <div style={{
                    width: '120px', height: '120px', borderRadius: '50%',
                    background: 'linear-gradient(135deg,var(--color-brand-600),#075e54)',
                    border: '3px solid var(--color-brand-600)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}>
                    <span style={{ fontSize: '36px', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                      {(name || 'A').slice(0, 1).toUpperCase()}
                    </span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>sem foto</span>
                  </div>
                )}
                {uploadingAvatar && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-spinner fa-spin" style={{ color: 'white', fontSize: '24px' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <label style={{
                  background: 'var(--color-brand-600)', border: 'none', borderRadius: '8px', color: 'white',
                  padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <i className="fas fa-upload" />Upload
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => handleAvatarUpload(e.target.files[0])} />
                </label>
                {avatarUrl && (
                  <button onClick={handleRemoveAvatar} style={{
                    background: 'var(--color-bg-card)', border: '1px solid #ef4444', borderRadius: '8px',
                    color: '#ef4444', padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
                  }}>
                    <i className="fas fa-trash" />
                  </button>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center' }}>PNG, JPEG ou WebP · máx. 3MB</div>
            </div>

            {/* ── Preview ── */}
            <div style={{ ...S.card, gap: '12px' }}>
              <div style={S.sectionTitle}><i className="fas fa-eye" style={{ color: 'var(--color-brand-600)' }} />Preview da Mensagem</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Como o agente se identificará nos resumos enviados:</div>

              {/* Mock WhatsApp-style bubble */}
              <div style={{ background: 'var(--color-bg-card)', borderRadius: '10px', padding: '14px', border: '1px solid var(--color-border-card)' }}>
                {/* Avatar + nome */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--color-brand-600),#075e54)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'white' }}>
                      {(name || 'A').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-brand-600)' }}>{name || 'Agente ENVOX'}</span>
                </div>
                {/* Balão */}
                <div style={{
                  background: 'var(--color-bg-card)', borderRadius: '0 10px 10px 10px',
                  padding: '12px 14px', fontSize: '12px', color: 'var(--color-text-primary)', lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                }}>
                  {previewMsg}
                </div>
                {/* Imagem da expressão após a mensagem */}
                {previewExpr?.image_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <img src={previewExpr.image_url} alt={previewExpr.label}
                      style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-brand-600)' }} />
                    <span style={{ fontSize: '10px', color: 'var(--color-text-placeholder)' }}>Imagem da expressão enviada após a mensagem</span>
                  </div>
                ) : (
                  <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--color-text-primary)', fontStyle: 'italic' }}>
                    {previewExpr?.emoji} Adicione uma foto à expressão "{previewExpr?.label}" para ela aparecer aqui
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Automações do Sistema — CRUD completo (admin) — D-026 ────────
const AUTOM_DOW_OPTIONS = [
  ['mon', 'seg'], ['tue', 'ter'], ['wed', 'qua'], ['thu', 'qui'],
  ['fri', 'sex'], ['sat', 'sáb'], ['sun', 'dom'],
];

const AUTOM_SEVERITY_OPTIONS = [
  ['low', 'Baixa', 'var(--color-text-muted)'],
  ['medium', 'Média', '#ca8a04'],
  ['high', 'Alta', '#ea580c'],
  ['critical', 'Crítica', '#dc2626'],
];

function AutomJobRow({ job, onSaved }) {
  const [editing, setEditing] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const ed = job.editavel || {};
  const [hour, setHour] = React.useState(ed.hour ?? 6);
  const [minute, setMinute] = React.useState(ed.minute ?? 0);
  const [dow, setDow] = React.useState(ed.day_of_week || 'sun');
  const [intervalMin, setIntervalMin] = React.useState(ed.interval_minutes ?? 15);

  const numInput = { width: '64px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--color-border-input)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' };
  const descStyle = { fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 };

  async function toggleEnabled() {
    setToggling(true);
    try {
      await window.apiPatch(`/system/jobs/${job.id}`, { enabled: !job.enabled });
      window.showToast(job.enabled ? 'Job desativado' : 'Job ativado', 'success');
      onSaved();
    } catch (e) {
      window.showToast(e.message || 'Erro ao atualizar job', 'error');
    } finally {
      setToggling(false);
    }
  }

  async function saveSchedule() {
    setSaving(true);
    try {
      const body = ed.tipo === 'interval'
        ? { interval_minutes: parseInt(intervalMin) }
        : ed.tipo === 'cron_weekly'
        ? { day_of_week: dow, hour: parseInt(hour), minute: parseInt(minute) }
        : { hour: parseInt(hour), minute: parseInt(minute) };
      await window.apiPatch(`/system/jobs/${job.id}`, body);
      window.showToast('Agendamento atualizado!', 'success');
      setEditing(false);
      onSaved();
    } catch (e) {
      window.showToast(e.message || 'Erro ao salvar agendamento', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '12px 14px', background: 'var(--color-bg-page)', borderRadius: '10px', border: '1px solid var(--color-border-card)', opacity: job.enabled ? 1 : 0.55 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{job.nome}</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {job.envia_whatsapp && (
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '9999px', background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
              <i className="fab fa-whatsapp" style={{ marginRight: '4px' }}></i>Envia WhatsApp
            </span>
          )}
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: '#e0f2f1', color: 'var(--color-brand-600)', fontWeight: 600 }}>{job.quando}</span>
          <button onClick={() => setEditing(v => !v)} title="Editar agendamento" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-brand-600)', fontSize: '13px', padding: '2px 6px' }}>
            <i className="fas fa-pen"></i>
          </button>
          <button onClick={toggleEnabled} disabled={toggling} title={job.enabled ? 'Desativar' : 'Ativar'} style={{ background: 'none', border: 'none', cursor: toggling ? 'wait' : 'pointer', fontSize: '18px', color: job.enabled ? '#16a34a' : 'var(--color-text-secondary)', padding: '2px 4px' }}>
            <i className={job.enabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off'}></i>
          </button>
        </div>
      </div>
      <div style={descStyle}>{job.descricao}</div>
      {job.detalhe && <div style={{ ...descStyle, marginTop: '4px', fontStyle: 'italic', color: 'var(--color-text-tertiary, var(--color-text-secondary))' }}>{job.detalhe}</div>}
      {job.proxima_execucao && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
          Próxima execução: {new Date(job.proxima_execucao).toLocaleString('pt-BR')}
        </div>
      )}
      {editing && (
        <div style={{ marginTop: '10px', padding: '10px 12px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {ed.tipo === 'interval' ? (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', marginBottom: '4px' }}>Intervalo (minutos)</div>
              <input type="number" min="1" style={numInput} value={intervalMin} onChange={e => setIntervalMin(e.target.value)} />
            </div>
          ) : (
            <>
              {ed.tipo === 'cron_weekly' && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', marginBottom: '4px' }}>Dia da semana</div>
                  <select style={numInput} value={dow} onChange={e => setDow(e.target.value)}>
                    {AUTOM_DOW_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', marginBottom: '4px' }}>Hora</div>
                <input type="number" min="0" max="23" style={numInput} value={hour} onChange={e => setHour(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', marginBottom: '4px' }}>Minuto</div>
                <input type="number" min="0" max="59" style={numInput} value={minute} onChange={e => setMinute(e.target.value)} />
              </div>
            </>
          )}
          <button onClick={saveSchedule} disabled={saving} style={{ padding: '7px 14px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '8px', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  );
}

function AutomThresholdInput({ item, onSaved }) {
  const [value, setValue] = React.useState(item.value);
  const [saving, setSaving] = React.useState(false);
  const dirty = String(value) !== String(item.value);

  async function save() {
    setSaving(true);
    try {
      await window.apiPatch(`/system/settings/${item.key}`, { value: parseFloat(value) });
      window.showToast('Configuração atualizada!', 'success');
      onSaved();
    } catch (e) {
      window.showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '8px 12px', background: 'var(--color-bg-page)', borderRadius: '8px', border: '1px solid var(--color-border-card)' }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-placeholder)', marginBottom: '4px' }}>{item.label}</div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{ width: '76px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--color-border-input)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
        />
        {dirty && (
          <button onClick={save} disabled={saving} title="Salvar" style={{ background: 'var(--color-brand-600)', border: 'none', color: 'white', borderRadius: '6px', width: '26px', height: '26px', cursor: saving ? 'not-allowed' : 'pointer' }}>
            <i className="fas fa-check" style={{ fontSize: '11px' }}></i>
          </button>
        )}
      </div>
    </div>
  );
}

function AutomAlertRuleModal({ rule, onClose, onSaved }) {
  const isNew = !rule;
  const [nome, setNome] = React.useState(rule?.nome || '');
  const [keywords, setKeywords] = React.useState(rule?.keywords || []);
  const [newKw, setNewKw] = React.useState('');
  const [severity, setSeverity] = React.useState(rule?.severity || 'medium');
  const [ativo, setAtivo] = React.useState(rule?.ativo ?? true);
  const [saving, setSaving] = React.useState(false);

  const inputStyle = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none',
    background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
  };
  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' };

  function addKeyword() {
    const v = newKw.trim().toLowerCase();
    if (v && !keywords.includes(v)) {
      setKeywords(k => [...k, v]);
      setNewKw('');
    }
  }

  async function save() {
    if (!nome.trim() || keywords.length === 0) {
      window.showToast('Preencha nome e ao menos uma palavra-chave.', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = { nome: nome.trim(), keywords, severity, ativo };
      if (isNew) await window.apiPost('/system/alert-rules', body);
      else await window.apiPatch(`/system/alert-rules/${rule.id}`, body);
      window.showToast(isNew ? 'Regra criada!' : 'Regra atualizada!', 'success');
      onSaved();
    } catch (e) {
      window.showToast(e.message || 'Erro ao salvar regra', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-bg-card)', borderRadius: '16px', padding: '28px', width: '460px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
            <i className="fas fa-bell" style={{ marginRight: '8px', color: 'var(--color-brand-600)' }}></i>
            {isNew ? 'Nova Regra de Alerta' : 'Editar Regra de Alerta'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '18px' }}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Nome da regra</label>
            <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Menção a concorrente" />
          </div>
          <div>
            <label style={labelStyle}>Palavras-chave (dispara se qualquer uma aparecer na mensagem)</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                style={inputStyle} value={newKw} onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                placeholder="Digite e pressione Enter"
              />
              <button onClick={addKeyword} style={{ padding: '0 14px', background: '#e0f2f1', color: 'var(--color-brand-600)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 600 }}>+</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {keywords.map(kw => (
                <span key={kw} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '9999px', background: 'var(--color-bg-page)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {kw}
                  <i className="fas fa-times" style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }} onClick={() => setKeywords(k => k.filter(x => x !== kw))}></i>
                </span>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Severidade</label>
            <select style={inputStyle} value={severity} onChange={e => setSeverity(e.target.value)}>
              {AUTOM_SEVERITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--color-brand-600)' }} />
            <span>Regra ativa</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'var(--color-bg-page)', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {saving ? <><Spinner size={12} /> Salvando...</> : <><i className="fas fa-check"></i> {isNew ? 'Criar' : 'Salvar'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function AutomationsScreen() {
  const [data, setData]       = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError]     = React.useState(null);
  const [ruleModal, setRuleModal] = React.useState(null); // null | 'new' | rule object
  const [deletingId, setDeletingId] = React.useState(null);

  const load = React.useCallback(() => {
    return window.apiGet('/system/automations')
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message || 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function deleteRule(rule) {
    if (!window.confirm(`Excluir a regra "${rule.nome}"?`)) return;
    setDeletingId(rule.id);
    try {
      await window.apiDelete(`/system/alert-rules/${rule.id}`);
      window.showToast('Regra excluída.', 'success');
      load();
    } catch (e) {
      window.showToast(e.message || 'Erro ao excluir regra', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  const card = { background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-card)', padding: '18px 20px', marginBottom: '16px' };
  const cardTitle = { fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' };
  const descStyle = { fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Automações do Sistema" subtitle="Tudo que roda sozinho — jobs, regras e limites, agora editáveis por aqui" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--color-bg-page)' }}>
        {loading && <SectionLoader />}
        {error && <div style={{ padding: '16px', color: '#dc2626' }}>{error}</div>}

        {data && (
          <>
            {data.correcoes_recentes?.length > 0 && (
              <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div style={{ ...cardTitle, color: '#166534' }}>
                  <span><i className="fas fa-circle-check"></i> Correções recentes</span>
                </div>
                {data.correcoes_recentes.map((c, i) => (
                  <div key={i} style={{ marginBottom: i < data.correcoes_recentes.length - 1 ? '12px' : 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#166534', marginBottom: '4px' }}>{c.titulo}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: '#14532d', lineHeight: 1.6 }}>{c.descricao}</div>
                  </div>
                ))}
              </div>
            )}

            {data.limitacoes_conhecidas?.length > 0 && (
              <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca' }}>
                <div style={{ ...cardTitle, color: '#991b1b' }}>
                  <span><i className="fas fa-triangle-exclamation"></i> Limitações conhecidas</span>
                </div>
                {data.limitacoes_conhecidas.map((l, i) => (
                  <div key={i} style={{ marginBottom: i < data.limitacoes_conhecidas.length - 1 ? '12px' : 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#991b1b', marginBottom: '4px' }}>{l.titulo}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: '#7f1d1d', lineHeight: 1.6 }}>{l.descricao}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={card}>
              <div style={cardTitle}><span><i className="fas fa-clock" style={{ color: 'var(--color-brand-600)' }}></i> Jobs agendados</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(data.jobs_agendados || []).map(job => (
                  <AutomJobRow key={job.id} job={job} onSaved={load} />
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}><span><i className="fas fa-bell" style={{ color: '#ca8a04' }}></i> Thresholds de alerta</span></div>
              <div style={descStyle}>{data.alertas?.descricao}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                {(data.alertas?.editavel || []).map(item => (
                  <AutomThresholdInput key={item.key} item={item} onSaved={load} />
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>
                <span><i className="fas fa-bullseye" style={{ color: 'var(--color-brand-600)' }}></i> Regras de Alerta Customizadas</span>
                <button onClick={() => setRuleModal('new')} style={{ padding: '6px 12px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '8px', fontSize: 'var(--text-xs)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fas fa-plus"></i> Nova regra
                </button>
              </div>
              <div style={{ ...descStyle, marginBottom: '10px' }}>
                Regras criadas pelo admin: se qualquer palavra-chave aparecer em uma mensagem, gera um alerta automaticamente com a severidade escolhida.
              </div>
              {(data.regras_alerta_customizadas || []).length === 0 && (
                <div style={{ ...descStyle, fontStyle: 'italic' }}>Nenhuma regra customizada criada ainda.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(data.regras_alerta_customizadas || []).map(rule => {
                  const sevInfo = AUTOM_SEVERITY_OPTIONS.find(s => s[0] === rule.severity) || AUTOM_SEVERITY_OPTIONS[1];
                  return (
                    <div key={rule.id} style={{ padding: '10px 12px', background: 'var(--color-bg-page)', borderRadius: '8px', border: '1px solid var(--color-border-card)', opacity: rule.ativo ? 1 : 0.55 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{rule.nome}</span>
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '9999px', background: sevInfo[2] + '22', color: sevInfo[2], fontWeight: 700 }}>{sevInfo[1]}</span>
                          {!rule.ativo && <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>(inativa)</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => setRuleModal(rule)} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-brand-600)', fontSize: '13px', padding: '4px 8px' }}>
                            <i className="fas fa-pen"></i>
                          </button>
                          <button onClick={() => deleteRule(rule)} disabled={deletingId === rule.id} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '13px', padding: '4px 8px' }}>
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {(rule.keywords || []).map(kw => (
                          <span key={kw} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: 'var(--color-bg-page)', color: 'var(--color-text-muted)' }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}><span><i className="fas fa-lightbulb" style={{ color: '#16a34a' }}></i> Heurística de oportunidade (2 camadas)</span></div>
              <div style={descStyle}>{data.heuristica_oportunidade?.descricao}</div>
            </div>

            <div style={card}>
              <div style={cardTitle}><span><i className="fas fa-mobile-screen" style={{ color: 'var(--color-brand-600)' }}></i> Push notifications automáticas</span></div>
              <div style={descStyle}>{data.push_notifications?.descricao}</div>
            </div>

            <div style={card}>
              <div style={cardTitle}><span><i className="fas fa-rocket" style={{ color: 'var(--color-brand-600)' }}></i> Ao ativar um grupo</span></div>
              <div style={descStyle}>{data.ativacao_de_grupo?.descricao}</div>
              <ul style={{ margin: '10px 0 0', paddingLeft: '20px' }}>
                {(data.ativacao_de_grupo?.itens || []).map((it, i) => (
                  <li key={i} style={{ ...descStyle, marginBottom: '6px' }}>{it}</li>
                ))}
              </ul>
            </div>

            <div style={card}>
              <div style={cardTitle}><span><i className="fas fa-database" style={{ color: 'var(--color-text-muted)' }}></i> Retenção de dados (LGPD)</span></div>
              <div style={descStyle}>{data.retencao_dados?.descricao}</div>
              {data.retencao_dados?.editavel && (
                <div style={{ marginTop: '10px' }}>
                  <AutomThresholdInput item={{ key: data.retencao_dados.editavel.key, label: 'Retenção (dias)', value: data.retencao_dados.editavel.value }} onSaved={load} />
                </div>
              )}
            </div>

            <div style={card}>
              <div style={cardTitle}><span><i className="fab fa-whatsapp" style={{ color: '#25d366' }}></i> Reconexão automática do WhatsApp</span></div>
              <div style={descStyle}>{data.reconexao_whatsapp?.descricao}</div>
            </div>
          </>
        )}
      </div>

      {ruleModal && (
        <AutomAlertRuleModal
          rule={ruleModal === 'new' ? null : ruleModal}
          onClose={() => setRuleModal(null)}
          onSaved={() => { setRuleModal(null); load(); }}
        />
      )}
    </div>
  );
}

Object.assign(window, { IntelligenceScreen, GroupsScreen, ConversationScreen, TagsScreen, SummaryScreen, TeamScreen, ApiDocsScreen, ConfigScreen, UsersScreen, UserProfileModal, EmailAccountsSection, EmailScreen, WppGroupsManagerScreen, RangeSummaryScreen, CustomAnalysisScreen, AgentConfigScreen, AutomationsScreen });
