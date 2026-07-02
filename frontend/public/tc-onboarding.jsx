// tc-onboarding.jsx — Wizard de onboarding para novos usuários

function OnboardingWizard({ onComplete }) {
  // Admins gerenciam o WhatsApp (step 1); usuários normais pulam direto para grupos (step 2)
  const isAdmin = localStorage.getItem('envox_is_admin') === 'true';
  const firstStep = isAdmin ? 1 : 2;

  const [step, setStep] = React.useState(firstStep);   // 1=wpp(admin), 2=grupo, 3=agente, 4=done

  // Step 1 — WhatsApp (só admin)
  const [wppConnected, setWppConnected] = React.useState(false);
  const [wppChecking, setWppChecking]   = React.useState(true);

  // Step 2 — Grupo
  const [groups, setGroups]             = React.useState([]);
  const [loadGroups, setLoadGroups]     = React.useState(false);
  const [activating, setActivating]     = React.useState(null);
  const [activatedGroup, setActivatedGroup] = React.useState(null);

  // Step 3 — Agente
  const [agentName, setAgentName]       = React.useState('');
  const [agentTone, setAgentTone]       = React.useState('profissional');
  const [savingAgent, setSavingAgent]   = React.useState(false);

  // Polling WhatsApp status
  React.useEffect(() => {
    if (step !== 1) return;
    const check = async () => {
      try {
        const r = await fetch('/api/v1/tenant/wpp/status', { headers: { Authorization: 'Bearer ' + window.getToken() } });
        const d = await r.json();
        setWppConnected(!!d.connected);
      } catch { setWppConnected(false); }
      finally { setWppChecking(false); }
    };
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, [step]);

  // Carrega grupos no step 2
  React.useEffect(() => {
    if (step !== 2) return;
    setLoadGroups(true);
    window.apiGet('/wpp/available-groups')
      .then(d => setGroups(Array.isArray(d) ? d.filter(g => !g.is_monitored) : []))
      .catch(() => setGroups([]))
      .finally(() => setLoadGroups(false));
  }, [step]);

  // Carrega config do agente no step 3
  React.useEffect(() => {
    if (step !== 3) return;
    window.apiGet('/agent/config').then(d => {
      setAgentName(d.name || '');
      setAgentTone(d.tone || 'profissional');
    }).catch(() => {});
  }, [step]);

  const activateGroup = async (g) => {
    setActivating(g.wpp_id);
    try {
      await window.apiPost('/wpp/groups/toggle', { wpp_id: g.wpp_id, name: g.name, participant_count: g.participant_count || 0, enable: true, days_back: 90 });
      setActivatedGroup(g);
    } catch(e) {
      window.showToast(e.message || 'Erro ao ativar grupo.', 'error');
    } finally { setActivating(null); }
  };

  const saveAgent = async () => {
    if (!agentName.trim()) { setStep(4); return; }
    setSavingAgent(true);
    try {
      await window.apiPut('/agent/config', { name: agentName, tone: agentTone });
    } catch {}
    finally { setSavingAgent(false); setStep(4); }
  };

  // Admin: 3 etapas (WhatsApp → Grupo → Agente); usuário normal: 2 etapas (Grupo → Agente)
  const totalSteps = isAdmin ? 3 : 2;
  const stepLabels = isAdmin
    ? ['Conectar WhatsApp', 'Selecionar grupo', 'Configurar agente']
    : ['Selecionar grupo', 'Configurar agente'];

  // Traduz step absoluto para posição no indicador (admin: 1→1, 2→2, 3→3; user: 2→1, 3→2)
  const stepPos = isAdmin ? step : step - 1;

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.96)', zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
  };

  const cardStyle = {
    background: '#0f172a', border: '1px solid #1e293b', borderRadius: '20px',
    width: 'min(520px, 100%)', maxHeight: '92vh', overflow: 'auto',
    boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
  };

  const btnPrimary = (disabled) => ({
    padding: '11px 24px', background: disabled ? '#1e293b' : '#0d9488', color: disabled ? '#475569' : 'white',
    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
    display: 'flex', alignItems: 'center', gap: '8px',
  });

  const btnGhost = {
    padding: '11px 20px', background: 'transparent', color: '#64748b',
    border: '1px solid #1e293b', borderRadius: '10px', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  };

  // ── Step indicator (baseado em posição relativa, não step absoluto) ──
  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
        <React.Fragment key={s}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: s < stepPos ? '#0d9488' : s === stepPos ? '#14b8a6' : '#1e293b',
            border: `2px solid ${s <= stepPos ? '#0d9488' : '#334155'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: s <= stepPos ? 'white' : '#475569',
          }}>
            {s < stepPos ? <i className="fas fa-check" style={{ fontSize: '10px' }}></i> : s}
          </div>
          <div style={{ flex: 1, display: s < totalSteps ? 'block' : 'none' }}>
            <div style={{ height: '2px', background: s < stepPos ? '#0d9488' : '#1e293b', borderRadius: '2px', transition: 'background 0.3s' }}></div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  // ── Step 1: WhatsApp ──
  if (step === 1) return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ padding: '28px' }}>
          <StepIndicator />
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '12px', background: wppConnected ? 'rgba(34,197,94,0.15)' : 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fab fa-whatsapp" style={{ fontSize: '24px', color: wppConnected ? '#22c55e' : '#14b8a6' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>
                {stepLabels[0]}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Etapa 1 de {totalSteps}</div>
            </div>
          </div>

          {wppChecking ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <Spinner size={28} color="#14b8a6" />
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '12px' }}>Verificando conexão...</div>
            </div>
          ) : wppConnected ? (
            <div style={{ textAlign: 'center', padding: '24px', background: 'rgba(34,197,94,0.08)', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.2)', marginBottom: '20px' }}>
              <i className="fas fa-check-circle" style={{ fontSize: '36px', color: '#22c55e', display: 'block', marginBottom: '10px' }}></i>
              <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '16px' }}>WhatsApp conectado!</div>
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Sua conta está ativa e pronta para receber mensagens.</div>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                Para começar a monitorar grupos do WhatsApp, você precisa conectar sua conta escaneando o QR Code pelo celular.
              </p>
              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '12px' }}>Acesse a tela de conexão para escanear o QR Code:</div>
                <WppConnectionScreen inOnboarding={true} onConnected={() => setWppConnected(true)} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            {!wppConnected && (
              <button style={btnGhost} onClick={() => setStep(2)}>Pular por agora</button>
            )}
            <button style={btnPrimary(!wppConnected && !false)} disabled={!wppConnected}
              onClick={() => wppConnected && setStep(2)}>
              Próximo <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step 2: Grupo ──
  if (step === 2) return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ padding: '28px' }}>
          <StepIndicator />
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-users" style={{ fontSize: '20px', color: '#14b8a6' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>{stepLabels[stepPos - 1]}</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Etapa {stepPos} de {totalSteps}</div>
            </div>
          </div>

          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px 0' }}>
            Escolha um grupo do WhatsApp para começar a monitorar. Você poderá adicionar mais grupos depois.
          </p>

          {activatedGroup ? (
            <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.2)', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <i className="fas fa-check-circle" style={{ color: '#22c55e', fontSize: '20px' }}></i>
              <div>
                <div style={{ fontWeight: 600, color: '#22c55e', fontSize: '14px' }}>{activatedGroup.name} ativado!</div>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>Importando histórico dos últimos 3 meses em background...</div>
              </div>
            </div>
          ) : loadGroups ? (
            <div style={{ textAlign: 'center', padding: '32px' }}><Spinner size={24} color="#14b8a6" /></div>
          ) : groups.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
              <i className="fas fa-comment-slash" style={{ fontSize: '28px', color: '#475569', display: 'block', marginBottom: '10px' }}></i>
              <div style={{ color: '#64748b', fontSize: '13px' }}>Nenhum grupo encontrado. Verifique se o WhatsApp está conectado.</div>
            </div>
          ) : (
            <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groups.slice(0, 20).map(g => (
                <div key={g.wpp_id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                    {(g.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name || g.wpp_id}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{g.participant_count || 0} participantes</div>
                  </div>
                  <button onClick={() => activateGroup(g)} disabled={!!activating}
                    style={{ padding: '6px 12px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '7px', cursor: activating ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {activating === g.wpp_id ? <Spinner size={12} color="white" /> : 'Monitorar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            {isAdmin && <button style={btnGhost} onClick={() => setStep(1)}>Voltar</button>}
            <button style={btnGhost} onClick={() => setStep(3)}>Pular</button>
            <button style={btnPrimary(!activatedGroup)} disabled={!activatedGroup}
              onClick={() => activatedGroup && setStep(3)}>
              Próximo <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step 3: Agente ──
  if (step === 3) return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ padding: '28px' }}>
          <StepIndicator />
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-robot" style={{ fontSize: '20px', color: '#14b8a6' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>{stepLabels[stepPos - 1]}</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Etapa {stepPos} de {totalSteps} · Opcional</div>
            </div>
          </div>

          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px 0' }}>
            Dê um nome e personalidade ao seu agente virtual. Ele assinará os resumos enviados no WhatsApp.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Nome do agente</label>
              <input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Ex: Maya, Alex, ENVOX Assistant..."
                style={{ width: '100%', padding: '10px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Tom de comunicação</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { value: 'profissional', label: '💼 Profissional', desc: 'Formal e objetivo' },
                  { value: 'amigavel',     label: '😊 Amigável',     desc: 'Próximo e caloroso' },
                  { value: 'executivo',    label: '📊 Executivo',     desc: 'Direto e estratégico' },
                  { value: 'casual',       label: '💬 Casual',        desc: 'Descontraído e leve' },
                ].map(t => (
                  <button key={t.value} onClick={() => setAgentTone(t.value)}
                    style={{ padding: '10px 12px', background: agentTone === t.value ? 'rgba(20,184,166,0.15)' : '#1e293b', border: `1px solid ${agentTone === t.value ? '#0d9488' : '#334155'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: agentTone === t.value ? '#14b8a6' : '#e2e8f0' }}>{t.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button style={btnGhost} onClick={() => setStep(2)}>Voltar</button>
            <button style={btnGhost} onClick={() => setStep(4)}>Configurar depois</button>
            <button style={btnPrimary(savingAgent)} disabled={savingAgent} onClick={saveAgent}>
              {savingAgent ? <Spinner size={14} color="white" /> : <><i className="fas fa-check"></i> Concluir</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step 4: Concluído ──
  return (
    <div style={overlayStyle}>
      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <div style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>🎉</div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px 0' }}>Tudo pronto!</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: '0 0 28px 0', maxWidth: '360px', display: 'inline-block' }}>
            Seu ENVOX Intelligence está configurado. Em breve você começará a receber insights dos seus grupos do WhatsApp.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={onComplete} style={{ ...btnPrimary(false), fontSize: '15px', padding: '12px 28px' }}>
              <i className="fas fa-rocket"></i> Ir para o Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingWizard });
