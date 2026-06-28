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
    padding: '5px 12px', borderRadius: '9999px', fontSize: '12px',
    cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '5px',
    background: tab === id ? '#0d9488' : '#e9edef',
    color: tab === id ? 'white' : '#54656f',
    border: 'none',
    fontWeight: tab === id ? 600 : 400, transition: 'all 0.15s ease',
  });

  const severityColor = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#22c55e' };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Inteligência Operacional" subtitle="Itens acionáveis detectados nos últimos 7 dias" />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Lista de itens — estilo WhatsApp */}
        <div style={{ flex: selected ? '0 0 380px' : 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: selected ? '1px solid #e9edef' : 'none' }}>
          {/* Tabs / Filter bar */}
          <div style={{ padding: '10px 16px', background: '#f0f2f5', display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid #e9edef' }}>
            {tabs.map(t => (
              <button key={t.id} style={tabStyle(t.id)} onClick={() => { setTab(t.id); setSelected(null); }}>
                <i className={`fas fa-${t.icon}`} style={{ fontSize: '11px' }}></i>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
            {loading
              ? <div style={{ textAlign: 'center', padding: '48px' }}><Spinner size={24} color="#0d9488" /></div>
              : items.length === 0
                ? <div style={{ textAlign: 'center', padding: '48px', color: '#8696a0', fontSize: 'var(--text-sm)' }}>
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
                          background: isActive ? '#f0fdfa' : 'white',
                          borderBottom: '1px solid #f0f2f5',
                          borderLeft: isActive ? '3px solid #0d9488' : '3px solid transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f5f6f6'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'white'; }}
                      >
                        {/* Avatar círculo */}
                        <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className={`fas fa-${meta.icon}`} style={{ color: 'white', fontSize: '18px' }}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.conversation_name}</span>
                            <span style={{ fontSize: '11px', color: '#8696a0', flexShrink: 0, marginLeft: '8px' }}>{ts}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: '#54656f', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
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
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: '#e9edef' }}>{context?.conversation?.name || selected.conversation_name}</div>
                  <div style={{ fontSize: '12px', color: '#8696a0' }}>Últimas mensagens</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onSelectGroup && (
                  <button onClick={() => onSelectGroup({ conversation_id: selected.conversation_id, conversation_name: context?.conversation?.name || selected.conversation_name, temperature_score: 0, open_alerts: 0, followups_pending: 0 })}
                    style={{ background: '#0d9488', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fas fa-comments"></i> Abrir
                  </button>
                )}
                <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', borderRadius: '50%', padding: '6px 8px', cursor: 'pointer', color: '#aebac3', fontSize: '14px' }}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Alert item badge */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #e9edef', background: '#f0f2f5' }}>
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
                ? <div style={{ textAlign: 'center', padding: '32px' }}><Spinner size={20} color="#0d9488" /></div>
                : !context || context.messages.length === 0
                  ? <div style={{ textAlign: 'center', padding: '32px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: '10px', padding: '16px 20px', display: 'inline-block', color: '#54656f', fontSize: 'var(--text-sm)' }}>Sem mensagens recentes neste grupo.</div>
                    </div>
                  : context.messages.map(msg => {
                      const t = msg.sent_at ? new Date(msg.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                      const isMe = msg.is_internal;
                      const hasBg = msg.is_churn_risk ? '#fff7ed' : msg.is_opportunity ? '#f0fdf4' : null;
                      const bubbleBg = isMe ? (hasBg || '#d9fdd3') : (hasBg || 'white');
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
                          <div style={{ maxWidth: '75%', background: bubbleBg, borderRadius: isMe ? '12px 0 12px 12px' : '0 12px 12px 12px', padding: '6px 10px 8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            {!isMe && <div style={{ fontSize: '11px', fontWeight: 600, color: '#0d9488', marginBottom: '2px' }}>{msg.type_icon} {msg.sender}</div>}
                            <div style={{ fontSize: '12px', color: '#111b21', lineHeight: 1.5 }}>
                              {msg.content || (msg.message_type !== 'text' ? `[${msg.message_type}]` : '')}
                            </div>
                            {msg.tags && msg.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {msg.tags.map(tag => (
                                  <span key={tag} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '9999px', background: isMe ? 'rgba(0,0,0,0.08)' : '#f0f2f5', color: '#54656f' }}>{tag}</span>
                                ))}
                              </div>
                            )}
                            {msg.risk_score >= 50 && <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '3px', fontWeight: 600 }}>⚠ Risco {msg.risk_score}</div>}
                            <div style={{ fontSize: '11px', color: '#8696a0', textAlign: 'right', marginTop: '3px' }}>{t}</div>
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
  const tempColor = (s) => s >= 80 ? '#16a34a' : s >= 60 ? '#0d9488' : s >= 40 ? '#ca8a04' : s >= 20 ? '#ea580c' : '#dc2626';
  const avatarColors = ['#0d9488', '#0891b2', '#7c3aed', '#be185d', '#d97706', '#15803d', '#b45309', '#0e7490'];
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
      <div style={{ padding: '10px 16px', background: '#f0f2f5', borderBottom: '1px solid #e9edef' }}>
        <div style={{ position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8696a0', fontSize: '13px' }}></i>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', boxSizing: 'border-box', border: 'none', borderRadius: '8px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', color: 'var(--color-text-primary)' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
        {loading
          ? <div style={{ textAlign: 'center', padding: '48px' }}><Spinner size={24} color="#0d9488" /></div>
          : filtered.length === 0
            ? <div style={{ textAlign: 'center', padding: '48px', color: '#8696a0', fontSize: 'var(--text-sm)' }}>
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
                    borderBottom: '1px solid #f0f2f5',
                    background: hovered === g.conversation_id ? '#f5f6f6' : 'white',
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
                              style={{ flex: 1, padding: '3px 8px', border: '1px solid #0d9488', borderRadius: '6px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                            <button onClick={e => saveEdit(g, e)} disabled={saving} style={{ padding: '3px 8px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                              {saving ? <Spinner size={10} /> : <i className="fas fa-check"></i>}
                            </button>
                            <button onClick={cancelEdit} style={{ padding: '3px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        )
                        : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.conversation_name}</span>
                            <button onClick={e => startEdit(g, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', padding: '2px 3px', borderRadius: '4px', flexShrink: 0, opacity: hovered === g.conversation_id ? 1 : 0, transition: 'opacity 0.1s' }}
                              title="Editar nome">
                              <i className="fas fa-pencil-alt" style={{ fontSize: '11px' }}></i>
                            </button>
                          </div>
                        )
                      }
                      <span style={{ fontSize: '11px', color: '#8696a0', flexShrink: 0, marginLeft: '8px' }}>{g.total_messages || 0} msg</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: '#8696a0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

  const tempColors = { excellent: '#16a34a', good: '#0d9488', attention: '#ca8a04', warning: '#ea580c', critical: '#dc2626' };

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
            ? <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={28} color="#0d9488" /></div>
            : !summary
              ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '16px', animation: 'fadeIn 0.4s ease' }}>
                  <div style={{ width: '72px', height: '72px', background: '#f0fdfa', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-magic" style={{ fontSize: '28px', color: '#0d9488' }}></i>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Resumo ainda não gerado</h3>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '380px' }}>
                    Clique em "Gerar Resumo" para consolidar os dados de hoje em um relatório executivo.
                  </p>
                  <button onClick={handleGenerate} style={{ padding: '10px 24px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
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
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: renderMd(summary.executive_text) }}></div>
                  </DsCard>

                  {summary.highlights?.length > 0 && (
                    <DsCard>
                      <SectionTitle icon="star" label="Destaques do Dia" color="#0d9488" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {summary.highlights.map((h, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: '#f0fdfa', borderRadius: 'var(--radius-lg)' }}>
                            <i className="fas fa-check-circle" style={{ color: '#0d9488', marginTop: '2px', flexShrink: 0 }}></i>
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
            ? <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={28} color="#7c3aed" /></div>
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
                            <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', marginTop: '2px' }}>
                              {briefing.generated_at ? 'Gerado às ' + new Date(briefing.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Gerado automaticamente'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '28px', fontWeight: 700, color: tempColors[briefing.temperature_label] || '#374151' }}>{briefing.temperature_score}</div>
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
                                          : <span style={{ color: '#94a3b8' }}>—</span>}
                                      </td>
                                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                        {g.followups > 0
                                          ? <span style={{ padding: '2px 8px', background: '#fffbeb', color: '#b45309', borderRadius: '9999px', fontWeight: 600 }}>{g.followups}</span>
                                          : <span style={{ color: '#94a3b8' }}>—</span>}
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
        <a href="/docs" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#0d9488', color: 'white', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', textDecoration: 'none', fontWeight: 500 }}>
          <i className="fas fa-external-link-alt"></i> Abrir Swagger UI
        </a>
      } />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DsCard>
          <SectionTitle icon="info-circle" label="Sobre a API" color="#0d9488" />
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
          const mc = { GET: '#ccfbf1', POST: '#dcfce7', PATCH: '#fef9c3', PUT: '#fef9c3', DELETE: '#fee2e2' };
          const tc = { GET: '#0f766e', POST: '#166534', PATCH: '#854d0e', PUT: '#854d0e', DELETE: '#991b1b' };
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
    background: 'white', color: 'var(--color-text-primary)',
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
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
            <i className="fas fa-user-plus" style={{ marginRight: '8px', color: '#0d9488' }}></i>
            {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px' }}>
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
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#0d9488' }} />
            <span>Administrador <span style={{ color: '#94a3b8', fontSize: 'var(--text-xs)' }}>(acesso total ao sistema)</span></span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-sans)' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '9px 18px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
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
        <button onClick={() => setModal('new')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
          <i className="fas fa-plus"></i> Novo usuário
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}><Spinner size={24} /></div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px', fontSize: 'var(--text-sm)' }}>Nenhum usuário cadastrado.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: u.is_active ? '#f8fafc' : '#fef2f2', border: '1px solid ' + (u.is_active ? 'var(--color-border-card)' : '#fecaca'), borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9999px', background: u.is_active ? '#ccfbf1' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-user" style={{ color: u.is_active ? '#0d9488' : '#ef4444', fontSize: '14px' }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{u.full_name || u.username}</span>
                  {u.full_name && <span style={{ fontSize: 'var(--text-xs)', color: '#94a3b8' }}>@{u.username}</span>}
                  {u.is_admin && <span style={{ background: '#ede9fe', color: '#7c3aed', fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '9999px' }}>Admin</span>}
                  {!u.is_active && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '9999px' }}>Inativo</span>}
                </div>
                {u.email && <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', marginTop: '1px' }}>{u.email}</div>}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => setModal(u)} title="Editar" style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: '#374151', fontSize: '13px' }}>
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
          <button onClick={saveConfig} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
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

        <UsersSection />

        <Section icon="whatsapp fab" title="Conexão WhatsApp (WPPConnect)">
          <div>
            <label style={labelStyle}>Sessão (atribuída automaticamente)</label>
            <input type="text" value={wppSession} readOnly style={{ ...inputStyle, background: '#f8fafc', color: '#64748b' }} />
            <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', marginTop: '4px' }}>Identificador único desta conta no WppConnect. Não pode ser alterado.</div>
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
            <a href="/docs" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#f8fafc', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', color: '#334155', textDecoration: 'none', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              <i className="fas fa-book" style={{ color: '#0d9488' }}></i> Swagger UI (API Docs)
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
    color: tab === id ? '#0d9488' : '#8696a0',
    fontWeight: tab === id ? 600 : 400,
    borderBottom: tab === id ? '2px solid #0d9488' : '2px solid transparent',
    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
  });

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header WhatsApp-style */}
      <div style={{ padding: '10px 16px', background: 'var(--color-neutral-900)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#aebac3', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fas fa-arrow-left" style={{ fontSize: '16px' }}></i>
        </button>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
          {initials(groupName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: '#e9edef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</div>
          <div style={{ fontSize: '12px', color: '#8696a0' }}>
            {group.open_alerts > 0 && <span style={{ color: '#ef9a9a', marginRight: '8px' }}>{group.open_alerts} alerta{group.open_alerts > 1 ? 's' : ''}</span>}
            {group.followups_pending > 0 && <span style={{ color: '#ffd54f', marginRight: '8px' }}>{group.followups_pending} follow-up</span>}
            <span>Temp: <strong style={{ color: group.temperature_score >= 60 ? '#4caf50' : group.temperature_score >= 40 ? '#ffd54f' : '#ef9a9a' }}>{group.temperature_score || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-card)', background: 'white', padding: '0 16px', flexShrink: 0 }}>
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
    { id: 'all',         label: 'Todas',     icon: 'comments',           color: '#0d9488' },
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
      {/* Filter pills */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e9edef', background: 'white', display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px',
            borderRadius: '9999px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', border: 'none',
            background: filter === f.id ? f.color : '#f0f2f5', color: filter === f.id ? 'white' : '#54656f',
            fontWeight: filter === f.id ? 600 : 400, transition: 'all 0.15s',
          }}>
            <i className={`fas fa-${f.icon}`} style={{ fontSize: '11px' }}></i>{f.label}
            {data && f.id === 'all' && <span style={{ marginLeft: '2px', opacity: 0.7 }}>({data.total})</span>}
          </button>
        ))}
      </div>

      {/* Chat area com fundo WhatsApp */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: '2px', background: '#e5ddd5' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '48px' }}><Spinner size={24} color="#0d9488" /></div>
          : !data || data.messages.length === 0
            ? <div style={{ textAlign: 'center', padding: '64px' }}>
                <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: '12px', padding: '20px 28px', display: 'inline-block' }}>
                  <i className="fas fa-comments" style={{ fontSize: '32px', color: '#aebac3', display: 'block', marginBottom: '10px' }}></i>
                  <span style={{ color: '#54656f', fontSize: 'var(--text-sm)' }}>
                    {filter !== 'all' ? 'Nenhuma mensagem com este filtro.' : 'Ainda não há mensagens neste grupo.'}
                  </span>
                </div>
              </div>
            : <>
                {hasMore && <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <button onClick={() => load(filter, false)} disabled={loadingMore}
                    style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.85)', color: '#0d9488', border: 'none', borderRadius: '9999px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    {loadingMore ? <><Spinner size={12} color="#0d9488" />&nbsp; Carregando...</> : '↑ Carregar anteriores'}
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
                            <span style={{ background: 'rgba(255,255,255,0.88)', color: '#54656f', fontSize: '12px', padding: '4px 12px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>{msgDate}</span>
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
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0d9488', marginBottom: '2px' }}>
                                {msg.type_icon} {msg.sender}
                              </div>
                            )}
                            {msg.content && (
                              <div style={{ fontSize: '13px', color: '#111b21', lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</div>
                            )}
                            {!msg.content && msg.message_type !== 'text' && (
                              <div style={{ fontSize: '13px', color: '#54656f', fontStyle: 'italic' }}>{msg.type_icon} [{msg.message_type}]</div>
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
                                {msg.tags.map(tag => <span key={tag} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '9999px', background: isMe ? 'rgba(0,0,0,0.08)' : '#f0f2f5', color: '#54656f' }}>{tag}</span>)}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: '#8696a0', textAlign: 'right', marginTop: '3px' }}>{t}</div>
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

  if (loading) return <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={24} color="#0d9488" /></div>;

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
              <button onClick={addDoc} style={{ fontSize: '12px', padding: '4px 10px', background: '#f0fdfa', color: '#0d9488', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}>
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
        <DsCard style={{ borderLeft: '4px solid #0d9488' }}>
          <SectionTitle icon="file-contract" label="Contrato e Escopo" color="#0d9488" />
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
        <button onClick={save} disabled={saving} style={{ padding: '10px 28px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
  const roleColors = { customer: '#0d9488', collaborator: '#16a34a', manager: '#7c3aed', bot: '#64748b', unknown: '#94a3b8' };
  const roleLabels = { customer: 'Cliente', collaborator: 'Colaborador', manager: 'Gestor', bot: 'Bot', unknown: '—' };
  const inp = { width: '100%', padding: '7px 10px', boxSizing: 'border-box', border: '1px solid var(--color-border-input)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' };

  if (loading) return <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={24} color="#0d9488" /></div>;
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
                    <button onClick={() => savePart(p)} disabled={saving} style={{ padding: '7px 18px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                      {saving ? <Spinner size={12} /> : 'Salvar'}
                    </button>
                    <button onClick={() => setEditId(null)} style={{ padding: '7px 14px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Cancelar</button>
                  </div>
                </div>
              )
              : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px' }}>
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
            ? <div style={{ textAlign: 'center', padding: '64px' }}><Spinner size={28} color="#0d9488" /></div>
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
                ? <div style={{ textAlign: 'center', padding: '32px' }}><Spinner size={20} color="#0d9488" /></div>
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
    background: 'white', color: 'var(--color-text-primary)',
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
    color: tab === id ? '#0d9488' : 'var(--color-text-secondary)',
    borderBottom: tab === id ? '2px solid #0d9488' : '2px solid transparent',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '420px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', background: '#f0fdfa', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-user-circle" style={{ color: '#0d9488', fontSize: '18px' }}></i>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>Meu Perfil</div>
              {profile && <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8' }}>@{profile.username}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}><Spinner size={24} color="#0d9488" /></div>
          ) : tab === 'profile' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" />
              </div>
              <div>
                <label style={labelStyle}>E-mail de recuperação</label>
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', marginTop: '4px' }}>Usado para recuperação de acesso</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button onClick={onClose} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveProfile} disabled={saving} style={{ padding: '9px 18px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                <button onClick={onClose} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleSavePassword} disabled={saving} style={{ padding: '9px 18px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
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
    { label: 'Total de usuários', value: users.length, icon: 'users', color: '#0d9488', bg: '#f0fdfa' },
    { label: 'Ativos',            value: totalActive,  icon: 'user-check', color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Inativos',          value: totalInactive, icon: 'user-slash', color: '#dc2626', bg: '#fef2f2' },
  ];

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Gestão de Usuários"
        subtitle="Gerencie contas, acesso e status de cada usuário"
        actions={
          <button onClick={() => setModal('new')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
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
              cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1px solid ' + (filter === f.id ? '#0d9488' : 'var(--color-border-default)'),
              background: filter === f.id ? '#f0fdfa' : 'white',
              color: filter === f.id ? '#0d9488' : 'var(--color-text-secondary)',
              fontWeight: filter === f.id ? 600 : 400,
            }}>{f.label}</button>
          ))}
        </div>

        {/* Lista de usuários */}
        <DsCard style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><Spinner size={28} color="#0d9488" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: 'var(--text-sm)' }}>
              <i className="fas fa-users" style={{ fontSize: '32px', display: 'block', marginBottom: '12px', opacity: 0.3 }}></i>
              Nenhum usuário encontrado.
            </div>
          ) : (
            <div>
              {/* Header da tabela (desktop) */}
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', padding: '10px 20px', borderBottom: '1px solid var(--color-border-default)', background: '#f8fafc' }}>
                  {['Usuário', 'Status', 'Conversas', 'Último acesso', ''].map(h => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</div>
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
                      <i className="fas fa-user" style={{ color: u.is_active ? '#0d9488' : '#ef4444', fontSize: '14px' }}></i>
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
                      <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8' }}>@{u.username}{u.email ? ` · ${u.email}` : ''}</div>
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
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--text-sm)', color: '#374151' }}>
                      <i className="fas fa-comments" style={{ color: '#94a3b8', marginRight: '6px', fontSize: '12px' }}></i>
                      {u.conversations_count ?? '—'}
                      {u.messages_count > 0 && <span style={{ color: '#94a3b8', fontSize: 'var(--text-xs)', marginLeft: '4px' }}>({u.messages_count} msgs)</span>}
                    </div>
                  )}

                  {/* Último acesso */}
                  {!isMobile && (
                    <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <i className="fas fa-clock" style={{ fontSize: '11px' }}></i>
                      {formatDate(u.last_login_at)}
                    </div>
                  )}

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: isMobile ? 'flex-end' : undefined }}>
                    <button onClick={() => setModal(u)} title="Editar" style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: '#374151', fontSize: '13px' }}>
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
    background: 'white', color: 'var(--color-text-primary)',
  };
  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' };

  return (
    <DsCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <SectionTitle icon="envelope" label="Contas de E-mail Monitoradas" color="#0d9488" />
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: showForm ? '#f1f5f9' : '#0d9488', color: showForm ? '#374151' : 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontWeight: 500, fontFamily: 'var(--font-sans)' }}
        >
          <i className={`fas fa-${showForm ? 'times' : 'plus'}`}></i> {showForm ? 'Cancelar' : 'Adicionar conta'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f8fafc', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              <input type="checkbox" id="use_ssl" checked={form.use_ssl} onChange={e => setForm(f => ({...f, use_ssl: e.target.checked}))} style={{ width: '16px', height: '16px', accentColor: '#0d9488', cursor: 'pointer' }} />
              <label htmlFor="use_ssl" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Usar SSL/TLS</label>
            </div>
          </div>
          <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#0f766e' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
            Para Gmail, use uma <strong>App Password</strong> (Configurações → Segurança → Senhas de app). Porta padrão IMAP SSL: 993.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
              {saving ? <><Spinner size={12} />&nbsp; Salvando...</> : <><i className="fas fa-check"></i>&nbsp; Salvar conta</>}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}><i className="fas fa-spinner fa-spin"></i></div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
          <i className="fas fa-envelope-open" style={{ fontSize: '28px', marginBottom: '10px', display: 'block', opacity: 0.4 }}></i>
          <div style={{ fontSize: 'var(--text-sm)' }}>Nenhuma conta de e-mail configurada.</div>
          <div style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>Adicione uma conta acima para começar o monitoramento.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#f8fafc', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-envelope" style={{ color: '#0d9488', fontSize: '16px' }}></i>
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
                  style={{ padding: '6px 12px', background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: '8px', fontSize: '12px', cursor: testing === acc.id ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
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
  const colors   = ['#0d9488', '#0891b2', '#7c3aed', '#be185d', '#d97706', '#15803d'];
  const colorFor = (i) => colors[i % colors.length];

  const EmptyAccounts = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
        <i className="fas fa-envelope" style={{ fontSize: '28px', color: '#0d9488' }}></i>
      </div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)', marginBottom: '8px' }}>Nenhuma conta configurada</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', maxWidth: '320px', lineHeight: 1.6 }}>
        Adicione contas IMAP nas configurações para monitorar e-mails recebidos.
      </div>
      <button
        onClick={() => onNavigateConfig && onNavigateConfig()}
        style={{ marginTop: '24px', padding: '10px 22px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <i className="fas fa-cog"></i> Ir para Configurações
      </button>
    </div>
  );

  const AccountList = () => (
    <div style={{ width: isMobile ? '100%' : '320px', borderRight: isMobile ? 'none' : '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'white', height: '100%' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-default)', background: '#f0f2f5' }}>
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
              background: selected?.id === acc.id ? '#f0fdfa' : 'white',
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5', height: '100%' }}>
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
          <i className="fas fa-envelope-open" style={{ fontSize: '48px', color: '#aebac3', marginBottom: '16px' }}></i>
          <div style={{ fontSize: 'var(--text-sm)', color: '#54656f' }}>Selecione uma conta para ver os e-mails</div>
        </div>
      ) : (
        <>
          <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '15px', flexShrink: 0 }}>
              {initials(selected.label)}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{selected.label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{selected.username} · {selected.host}</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '32px 40px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '440px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <i className="fas fa-cogs" style={{ fontSize: '22px', color: '#0d9488' }}></i>
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
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#f8fafc', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
          >
            <i className="fas fa-plus" style={{ color: '#0d9488' }}></i> Adicionar conta
          </button>
        }
      />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: '#0d9488' }}></i>
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
function WppGroupsManagerScreen() {
  const [groups,  setGroups]  = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search,  setSearch]  = React.useState('');
  const [filter,  setFilter]  = React.useState('all'); // all | monitored | unmonitored
  const [toggling, setToggling] = React.useState({});  // wpp_id → bool
  const [editingId, setEditingId] = React.useState(null);
  const [editName,  setEditName]  = React.useState('');

  const load = () => {
    setLoading(true);
    window.apiGet('/wpp/available-groups')
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .catch(() => window.showToast('Erro ao carregar grupos. Verifique a conexão WhatsApp.', 'error'))
      .finally(() => setLoading(false));
  };

  React.useEffect(load, []);

  const filtered = groups.filter(g => {
    const name = (g.custom_name || g.name || '').toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchFilter = filter === 'all'
      || (filter === 'monitored' && g.is_monitored)
      || (filter === 'unmonitored' && !g.is_monitored);
    return matchSearch && matchFilter;
  });

  const monitoredCount = groups.filter(g => g.is_monitored).length;

  async function handleToggle(g) {
    setToggling(t => ({ ...t, [g.wpp_id]: true }));
    try {
      await window.apiPost('/wpp/groups/toggle', {
        wpp_id: g.wpp_id,
        name: g.name,
        participant_count: g.participant_count,
        enable: !g.is_monitored,
      });
      setGroups(prev => prev.map(x =>
        x.wpp_id === g.wpp_id ? { ...x, is_monitored: !x.is_monitored } : x
      ));
      window.showToast(g.is_monitored ? 'Monitoramento desativado.' : 'Grupo ativado para monitoramento!', g.is_monitored ? 'info' : 'success');
    } catch {
      window.showToast('Erro ao alterar monitoramento.', 'error');
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
    const displayName = g.custom_name || g.name || g.wpp_id;
    const initials = displayName.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
    const isEditing = editingId === g.wpp_id;

    return (
      <div style={{
        background: '#1e293b', border: `1px solid ${g.is_monitored ? '#0d9488' : '#334155'}`,
        borderRadius: '12px', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '14px',
        transition: 'border-color 0.2s',
      }}>
        {/* Avatar */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
          background: g.is_monitored ? 'linear-gradient(135deg,#0d9488,#075e54)' : '#374151',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 700, color: 'white',
        }}>
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveCustomName(g); if (e.key === 'Escape') setEditingId(null); }}
                style={{
                  flex: 1, background: '#0f172a', border: '1px solid #0d9488', borderRadius: '6px',
                  color: '#f1f5f9', padding: '4px 8px', fontSize: '14px',
                }}
              />
              <button onClick={() => saveCustomName(g)} style={{ background: '#0d9488', border: 'none', borderRadius: '6px', color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: '13px' }}>OK</button>
              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </span>
              {g.is_monitored && (
                <button
                  onClick={() => { setEditingId(g.wpp_id); setEditName(g.custom_name || g.name || ''); }}
                  title="Editar nome"
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', fontSize: '11px', flexShrink: 0 }}
                >
                  <i className="fas fa-pen" />
                </button>
              )}
            </div>
          )}
          {g.custom_name && !isEditing && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>Original: {g.name}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              <i className="fas fa-users" style={{ marginRight: '4px' }}></i>{g.participant_count} participantes
            </span>
            {g.is_monitored && (
              <span style={{ fontSize: '11px', background: 'rgba(13,148,136,0.15)', color: '#0d9488', padding: '1px 8px', borderRadius: '999px', fontWeight: 600 }}>
                Monitorado
              </span>
            )}
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => handleToggle(g)}
          disabled={isToggling}
          style={{
            background: g.is_monitored ? '#0d9488' : '#374151',
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
        title="Gerenciar Grupos"
        subtitle={`${monitoredCount} monitorado(s) de ${groups.length} disponíveis`}
        action={
          <button onClick={load} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px' }}>
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
            flex: 1, minWidth: '200px', background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', color: '#f1f5f9', padding: '9px 14px', fontSize: '14px',
          }}
        />
        {['all', 'monitored', 'unmonitored'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? '#0d9488' : '#1e293b',
            border: `1px solid ${filter === f ? '#0d9488' : '#334155'}`,
            borderRadius: '8px', color: filter === f ? 'white' : '#94a3b8',
            padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
          }}>
            {f === 'all' ? 'Todos' : f === 'monitored' ? 'Monitorados' : 'Não monitorados'}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '80px', gap: '12px' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '20px', color: '#0d9488' }}></i>
            <span style={{ color: '#94a3b8' }}>Carregando grupos...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '60px', color: '#64748b' }}>
            <i className="fas fa-users-slash" style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}></i>
            Nenhum grupo encontrado.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(g => <GroupCard key={g.wpp_id} g={g} />)}
          </div>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// RangeSummaryScreen — Resumo por período customizado
// ─────────────────────────────────────────────────────────────
function RangeSummaryScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [conversations, setConversations] = React.useState([]);
  const [convSearch,    setConvSearch]    = React.useState('');
  const [selectedConv,  setSelectedConv]  = React.useState(null);
  const [startDate,     setStartDate]     = React.useState(weekAgo);
  const [endDate,       setEndDate]       = React.useState(today);
  const [loading,       setLoading]       = React.useState(false);
  const [loadingConvs,  setLoadingConvs]  = React.useState(false);
  const [result,        setResult]        = React.useState(null);
  const [showConvList,  setShowConvList]  = React.useState(false);

  const isMobile = useIsMobile();

  // Carrega conversas
  React.useEffect(() => {
    setLoadingConvs(true);
    window.apiGet('/conversations?limit=200')
      .then(d => setConversations(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingConvs(false));
  }, []);

  const filteredConvs = conversations.filter(c =>
    !convSearch || c.name.toLowerCase().includes(convSearch.toLowerCase())
  );

  function setQuickRange(days) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  }

  async function handleGenerate() {
    if (!selectedConv) { window.showToast('Selecione um grupo.', 'warning'); return; }
    if (!startDate || !endDate) { window.showToast('Informe o período.', 'warning'); return; }
    if (startDate > endDate) { window.showToast('Data inicial deve ser anterior à final.', 'warning'); return; }

    setLoading(true);
    setResult(null);
    try {
      const data = await window.apiGet(
        `/conversations/${selectedConv.id}/range-summary?start_date=${startDate}&end_date=${endDate}`
      );
      setResult(data);
    } catch(e) {
      window.showToast('Erro ao gerar resumo. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const TEMP_COLORS = { critico: '#ef4444', alerta: '#f59e0b', moderado: '#3b82f6', saudavel: '#10b981' };
  const TEMP_LABELS = { critico: 'Crítico', alerta: 'Em Alerta', moderado: 'Moderado', saudavel: 'Saudável' };

  function StatBox({ label, value, color, icon }) {
    return (
      <div style={{ background: '#1e293b', borderRadius: '10px', padding: '14px 16px', border: '1px solid #334155' }}>
        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>
          <i className={`fas fa-${icon}`} style={{ marginRight: '5px' }}></i>{label}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: color || '#f1f5f9' }}>{value}</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="Resumo por Período" subtitle="Analise qualquer grupo em qualquer faixa de datas" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>

        {/* ── Formulário ── */}
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: '14px',
          padding: '20px', marginBottom: '24px',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px',
          alignItems: 'end',
        }}>

          {/* Seleção de grupo */}
          <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-users" style={{ marginRight: '6px' }}></i>Grupo / Conversa
            </label>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowConvList(v => !v)}
                style={{
                  background: '#0f172a', border: `1px solid ${showConvList ? '#0d9488' : '#475569'}`,
                  borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: selectedConv ? '#f1f5f9' : '#64748b', fontSize: '14px',
                }}
              >
                <span>{selectedConv ? selectedConv.name : 'Selecionar grupo...'}</span>
                <i className={`fas fa-chevron-${showConvList ? 'up' : 'down'}`} style={{ fontSize: '11px', color: '#64748b' }} />
              </div>
              {showConvList && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden', marginTop: '4px',
                }}>
                  <div style={{ padding: '8px' }}>
                    <input
                      autoFocus
                      value={convSearch}
                      onChange={e => setConvSearch(e.target.value)}
                      placeholder="Buscar..."
                      style={{
                        width: '100%', background: '#0f172a', border: '1px solid #334155',
                        borderRadius: '6px', color: '#f1f5f9', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {loadingConvs ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Carregando...</div>
                    ) : filteredConvs.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Nenhum grupo encontrado.</div>
                    ) : filteredConvs.map(c => (
                      <div
                        key={c.id}
                        onClick={() => { setSelectedConv(c); setShowConvList(false); setConvSearch(''); }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                          color: selectedConv?.id === c.id ? '#0d9488' : '#d1d5db',
                          background: selectedConv?.id === c.id ? 'rgba(13,148,136,0.1)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (selectedConv?.id !== c.id) e.currentTarget.style.background = '#334155'; }}
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
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>Data Inicial
            </label>
            <input
              type="date" value={startDate} max={endDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Data fim */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>
              <i className="fas fa-calendar-check" style={{ marginRight: '6px' }}></i>Data Final
            </label>
            <input
              type="date" value={endDate} min={startDate} max={today}
              onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Atalhos + botão */}
          <div style={{ gridColumn: isMobile ? '1' : '1 / -1', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Atalhos:</span>
            {[[7,'7 dias'],[14,'14 dias'],[30,'30 dias'],[90,'3 meses']].map(([d, label]) => (
              <button key={d} onClick={() => setQuickRange(d)} style={{
                background: '#0f172a', border: '1px solid #475569', borderRadius: '6px',
                color: '#94a3b8', padding: '5px 12px', cursor: 'pointer', fontSize: '12px',
              }}>{label}</button>
            ))}
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedConv}
              style={{
                marginLeft: 'auto', background: loading || !selectedConv ? '#334155' : '#0d9488',
                border: 'none', borderRadius: '8px', color: 'white',
                padding: '10px 24px', cursor: loading || !selectedConv ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {loading ? <><i className="fas fa-spinner fa-spin" />Gerando...</> : <><i className="fas fa-chart-bar" />Gerar Resumo</>}
            </button>
          </div>
        </div>

        {/* ── Resultado ── */}
        {result && (
          <div>
            {/* Header do resultado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>{result.conversation.name}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  {result.period.start} → {result.period.end}
                </div>
              </div>
              <div style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px',
                background: '#1e293b', border: `2px solid ${TEMP_COLORS[result.temperature_label] || '#94a3b8'}`,
                borderRadius: '12px', padding: '10px 18px',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: TEMP_COLORS[result.temperature_label] || '#94a3b8' }}>
                  {result.temperature_score}
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Temperatura</div>
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
              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' }}>
                  <i className="fas fa-file-alt" style={{ marginRight: '6px' }}></i>Análise Executiva
                </div>
                <div
                  style={{ fontSize: '14px', lineHeight: 1.7, color: '#d1d5db' }}
                  dangerouslySetInnerHTML={{ __html: renderMd(result.executive_text) }}
                />
              </div>

              {/* Distribuição de tags */}
              {Object.keys(result.tag_distribution || {}).length > 0 && (
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' }}>
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
                      const color = TAG_COLORS[tag] || '#64748b';
                      return (
                        <div key={tag}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                            <span style={{ color: '#d1d5db' }}>{tag.replace(/_/g, ' ')}</span>
                            <span style={{ color: '#64748b' }}>{count}x</span>
                          </div>
                          <div style={{ height: '5px', background: '#334155', borderRadius: '3px' }}>
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
              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px' }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i>Mensagens de Maior Risco
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {result.top_messages.map((m, i) => (
                    <div key={m.id || i} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px 14px', borderLeft: `3px solid ${m.risk_score >= 70 ? '#ef4444' : m.risk_score >= 40 ? '#f59e0b' : '#64748b'}` }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{m.sent_at ? new Date(m.sent_at).toLocaleString('pt-BR') : ''}</span>
                        <span style={{ fontSize: '11px', background: m.risk_score >= 70 ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)', color: m.risk_score >= 70 ? '#ef4444' : '#94a3b8', padding: '1px 7px', borderRadius: '999px' }}>
                          Risco {m.risk_score}/100
                        </span>
                        {(m.tags || []).slice(0, 3).map(t => (
                          <span key={t} style={{ fontSize: '10px', background: '#1e293b', color: '#94a3b8', padding: '1px 7px', borderRadius: '999px', border: '1px solid #334155' }}>{t.replace(/_/g,' ')}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: '13px', color: '#d1d5db', lineHeight: 1.5 }}>{m.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div style={{ textAlign: 'center', paddingTop: '60px', color: '#64748b' }}>
            <i className="fas fa-chart-line" style={{ fontSize: '40px', display: 'block', marginBottom: '16px', color: '#334155' }}></i>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Selecione um grupo e um período</div>
            <div style={{ fontSize: '14px' }}>O resumo analítico será gerado com estatísticas, tags e análise executiva.</div>
          </div>
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
    .replace(/^>\s(.+)$/gm, '<blockquote style="border-left:3px solid #0d9488;margin:8px 0;padding:8px 12px;background:rgba(13,148,136,0.08);color:#94a3b8;border-radius:0 6px 6px 0">$1</blockquote>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;color:#f1f5f9;margin:12px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;color:#f1f5f9;margin:14px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:16px;color:#f1f5f9;margin:14px 0 8px">$1</h1>')
    .replace(/\n/g, '<br>');
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
      await fetch('/api/v1/agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + window.getToken() },
        body: JSON.stringify({
          name, role_label: roleLabel, personality, tone, signature,
          expressions: expressions.map(e => ({ type: e.type, label: e.label, emoji: e.emoji })),
        }),
      });
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
      if (!r.ok) { window.showToast('Erro ao enviar imagem.', 'error'); return; }
      const d = await r.json();
      setExpressions(prev => prev.map(e => e.type === type ? { ...e, image_url: d.image_url } : e));
      window.showToast('Expressão atualizada!', 'success');
    } catch { window.showToast('Erro.', 'error'); }
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

  // Componente auxiliar: card de expressão
  function ExprCard({ expr }) {
    const inputRef = React.useRef();
    const busy = uploadingExpr[expr.type];
    return (
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
        padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center',
        position: 'relative',
      }}>
        {/* Botão deletar expressão */}
        <button onClick={() => removeExpression(expr.type)} title="Remover expressão"
          style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px',
            background: '#374151', border: 'none', borderRadius: '50%', color: '#94a3b8',
            cursor: 'pointer', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.background = '#374151'}>
          <i className="fas fa-trash" />
        </button>
        {/* Imagem ou emoji */}
        <div style={{ position: 'relative', width: '72px', height: '72px' }}>
          {expr.image_url ? (
            <img src={expr.image_url} alt={expr.label}
              style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #334155' }} />
          ) : (
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%', background: '#0f172a',
              border: '2px dashed #475569', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px',
            }}>{expr.emoji}</div>
          )}
          {expr.image_url && (
            <button onClick={() => handleExprRemove(expr.type)}
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
          onChange={e => setExpressions(prev => prev.map(x => x.type === expr.type ? { ...x, label: e.target.value } : x))}
          maxLength={30}
          style={{
            width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px',
            color: '#f1f5f9', padding: '5px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600,
            boxSizing: 'border-box',
          }}
          placeholder="Rótulo"
        />
        {/* Emoji input */}
        <input
          value={expr.emoji}
          onChange={e => setExpressions(prev => prev.map(x => x.type === expr.type ? { ...x, emoji: e.target.value.slice(-2) } : x))}
          maxLength={2}
          style={{
            width: '52px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px',
            color: '#f1f5f9', padding: '6px', textAlign: 'center', fontSize: '20px',
          }}
          title="Emoji padrão"
        />
        {/* Upload imagem */}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => handleExprUpload(expr.type, e.target.files[0])} />
        <button onClick={() => inputRef.current.click()} disabled={busy}
          style={{
            background: '#0f172a', border: '1px solid #475569', borderRadius: '8px',
            color: '#94a3b8', padding: '5px 10px', cursor: busy ? 'wait' : 'pointer',
            fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px',
          }}>
          {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-image" />}
          {expr.image_url ? 'Trocar' : 'Upload'}
        </button>
      </div>
    );
  }

  // Preview de como ficará a mensagem
  const previewExpr = expressions.find(e => e.type === 'alert') || expressions[0];
  const previewEmoji = previewExpr?.emoji || '⚠️';
  const previewName = name || 'Agente ENVOX';
  const previewRole = roleLabel ? ` — ${roleLabel}` : '';
  const previewSig = signature ? `\n_${signature}_` : '';
  const previewMsg = `${previewEmoji} *${previewName}${previewRole}*\n━━━━━━━━━━━━━━━━━\n_Aqui virá o conteúdo do resumo gerado automaticamente..._\n━━━━━━━━━━━━━━━━━\n📝 _Gerado por ${previewName} · ENVOX Intelligence_${previewSig}`;

  const S = { // shared styles
    label: { display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: 500, marginBottom: '6px' },
    input: { width: '100%', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' },
    card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    sectionTitle: { fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' },
  };

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '20px', color: '#0d9488' }} />
      <span style={{ color: '#94a3b8' }}>Carregando configurações...</span>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Configuração do Agente"
        subtitle="Defina identidade, personalidade e expressões do agente automático"
        action={
          <button onClick={handleSave} disabled={saving} style={{
            background: saving ? '#334155' : '#0d9488', border: 'none', borderRadius: '8px',
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
              <div style={S.sectionTitle}><i className="fas fa-id-badge" style={{ color: '#0d9488' }} />Identidade do Agente</div>

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
                <label style={S.label}>Personalidade <span style={{ color: '#64748b', fontWeight: 400 }}>(usado nos prompts de IA)</span></label>
                <textarea value={personality} onChange={e => setPersonality(e.target.value)}
                  rows={4} style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }}
                  placeholder="Ex: Sou analítico, objetivo e empático. Priorizo clareza nas informações e destaco pontos críticos com urgência adequada. Evito linguagem técnica desnecessária." />
              </div>

              <div>
                <label style={S.label}>Tom de Comunicação</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {TONES.map(t => (
                    <div key={t.value} onClick={() => setTone(t.value)} style={{
                      border: `2px solid ${tone === t.value ? '#0d9488' : '#334155'}`,
                      background: tone === t.value ? 'rgba(13,148,136,0.12)' : '#0f172a',
                      borderRadius: '10px', padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: tone === t.value ? '#0d9488' : '#f1f5f9' }}>{t.label}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={S.label}>Assinatura <span style={{ color: '#64748b', fontWeight: 400 }}>(texto no rodapé das mensagens automáticas)</span></label>
                <input value={signature} onChange={e => setSignature(e.target.value)} style={S.input}
                  placeholder="ex: Este relatório foi gerado automaticamente. Dúvidas? Contate seu gestor." />
              </div>
            </div>

            {/* ── Expressões ── */}
            <div style={S.card}>
              <div>
                <div style={S.sectionTitle}><i className="fas fa-theater-masks" style={{ color: '#0d9488' }} />Expressões</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Crie, edite e remova expressões. Alterações são salvas pelo botão <strong style={{ color: '#94a3b8' }}>Salvar</strong> no topo.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                {expressions.map(expr => <ExprCard key={expr.type} expr={expr} />)}
              </div>
              {/* Nova expressão */}
              {newExprForm.open ? (
                <div style={{ background: '#0f172a', border: '1px dashed #475569', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Nova Expressão</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input value={newExprForm.emoji}
                      onChange={e => setNewExprForm(f => ({ ...f, emoji: e.target.value.slice(-2) }))}
                      maxLength={2}
                      style={{ width: '48px', background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9', padding: '6px', textAlign: 'center', fontSize: '18px' }}
                      placeholder="😊" />
                    <input value={newExprForm.label}
                      onChange={e => setNewExprForm(f => ({ ...f, label: e.target.value }))}
                      maxLength={30}
                      onKeyDown={e => e.key === 'Enter' && addExpression()}
                      style={{ flex: 1, background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9', padding: '7px 10px', fontSize: '13px' }}
                      placeholder="Nome da expressão (ex: Animado)"
                      autoFocus />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setNewExprForm({ open: false, label: '', emoji: '😊' })}
                      style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '8px', color: '#94a3b8', padding: '5px 12px', cursor: 'pointer', fontSize: '12px' }}>
                      Cancelar
                    </button>
                    <button onClick={addExpression} disabled={!newExprForm.label.trim()}
                      style={{ background: newExprForm.label.trim() ? '#0d9488' : '#334155', border: 'none', borderRadius: '8px', color: 'white', padding: '5px 12px', cursor: newExprForm.label.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600 }}>
                      Adicionar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setNewExprForm(f => ({ ...f, open: true }))}
                  style={{ background: 'transparent', border: '1px dashed #475569', borderRadius: '10px', color: '#64748b', padding: '10px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', transition: 'border-color 0.15s' }}>
                  <i className="fas fa-plus" /> Nova Expressão
                </button>
              )}
            </div>
          </div>

          {/* Coluna direita */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Avatar ── */}
            <div style={{ ...S.card, alignItems: 'center' }}>
              <div style={S.sectionTitle}><i className="fas fa-user-circle" style={{ color: '#0d9488' }} />Avatar</div>

              {/* Círculo de avatar */}
              <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar"
                    style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0d9488' }} />
                ) : (
                  <div style={{
                    width: '120px', height: '120px', borderRadius: '50%',
                    background: 'linear-gradient(135deg,#0d9488,#075e54)',
                    border: '3px solid #0d9488', display: 'flex', flexDirection: 'column',
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
                  background: '#0d9488', border: 'none', borderRadius: '8px', color: 'white',
                  padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <i className="fas fa-upload" />Upload
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => handleAvatarUpload(e.target.files[0])} />
                </label>
                {avatarUrl && (
                  <button onClick={handleRemoveAvatar} style={{
                    background: '#0f172a', border: '1px solid #ef4444', borderRadius: '8px',
                    color: '#ef4444', padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
                  }}>
                    <i className="fas fa-trash" />
                  </button>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>PNG, JPEG ou WebP · máx. 3MB</div>
            </div>

            {/* ── Preview ── */}
            <div style={{ ...S.card, gap: '12px' }}>
              <div style={S.sectionTitle}><i className="fas fa-eye" style={{ color: '#0d9488' }} />Preview da Mensagem</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Como o agente se identificará nos resumos enviados:</div>

              {/* Mock WhatsApp-style bubble */}
              <div style={{ background: '#0f172a', borderRadius: '10px', padding: '14px', border: '1px solid #1e293b' }}>
                {/* Avatar + nome */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#0d9488,#075e54)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'white' }}>
                      {(name || 'A').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d9488' }}>{name || 'Agente ENVOX'}</span>
                </div>
                {/* Balão */}
                <div style={{
                  background: '#1e293b', borderRadius: '0 10px 10px 10px',
                  padding: '12px 14px', fontSize: '12px', color: '#d1d5db', lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                }}>
                  {previewMsg}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { IntelligenceScreen, GroupsScreen, ConversationScreen, TagsScreen, SummaryScreen, TeamScreen, ApiDocsScreen, ConfigScreen, UsersScreen, UserProfileModal, EmailAccountsSection, EmailScreen, WppGroupsManagerScreen, RangeSummaryScreen, AgentConfigScreen });
