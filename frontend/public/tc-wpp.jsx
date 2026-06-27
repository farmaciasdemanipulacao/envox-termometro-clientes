// tc-wpp.jsx — WhatsApp Connection Screen (multi-tenant)
// Usa backend API /api/v1/tenant/wpp/* em vez de chamar WppConnect diretamente

// ── WppConnectionScreen ───────────────────────────────────────
function WppConnectionScreen() {
  const [phase, setPhase]       = React.useState('idle');   // idle|connecting|qrcode|connected|error
  const [qrSrc, setQrSrc]       = React.useState(null);
  const [message, setMessage]   = React.useState('');
  const [phone, setPhone]       = React.useState('');
  const [session, setSession]   = React.useState('');
  const pollRef                 = React.useRef(null);

  const stopPoll = () => clearInterval(pollRef.current);

  // Checa status ao montar
  React.useEffect(() => {
    window.apiGet('/tenant/wpp/status').then(s => {
      if (s.connected) {
        setPhase('connected');
        setPhone(s.phone || '');
        setSession(s.session || '');
      } else {
        setSession(s.session || '');
      }
    }).catch(() => {});
    return () => stopPoll();
  }, []);

  const fetchQR = async () => {
    try {
      const r = await fetch('/api/v1/tenant/wpp/qr', {
        headers: { Authorization: 'Bearer ' + window.getToken() },
      });
      if (r.status === 204) {
        // Sem QR → provavelmente conectado
        const s = await window.apiGet('/tenant/wpp/status');
        if (s.connected) { setPhase('connected'); setPhone(s.phone || ''); stopPoll(); }
        return;
      }
      if (!r.ok) return;
      const ct = r.headers.get('content-type') || '';
      if (ct.startsWith('image/')) {
        const blob = await r.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setQrSrc(reader.result);
          setPhase('qrcode');
          setMessage('Escaneie o QR Code com o WhatsApp do número dedicado');
        };
        reader.readAsDataURL(blob);
      }
    } catch (_) {}
  };

  const checkStatus = async () => {
    try {
      const s = await window.apiGet('/tenant/wpp/status');
      if (s.connected) {
        setPhase('connected');
        setPhone(s.phone || '');
        stopPoll();
      }
    } catch (_) {}
  };

  const handleConnect = async () => {
    setPhase('connecting');
    setMessage('Iniciando sessão...');
    setQrSrc(null);
    try {
      const data = await window.apiPost('/tenant/wpp/start', {});
      if (data.connected) {
        setPhase('connected');
        setPhone(data.phone || '');
        return;
      }
      // QR embutido na resposta do start-session
      if (data.qrcode) {
        setQrSrc(data.qrcode);
        setPhase('qrcode');
        setMessage('Escaneie o QR Code com o WhatsApp do número dedicado');
      } else {
        setMessage('Aguardando QR Code...');
        await new Promise(r => setTimeout(r, 1500));
        await fetchQR();
      }
      // Poll: renova QR + checa status a cada 5s
      pollRef.current = setInterval(async () => {
        await fetchQR();
        await checkStatus();
      }, 5000);
    } catch (err) {
      setPhase('error');
      setMessage('Erro: ' + err.message);
    }
  };

  const handleDisconnect = async () => {
    stopPoll();
    try { await window.apiPost('/tenant/wpp/disconnect', {}); } catch (_) {}
    setQrSrc(null);
    setPhase('idle');
    setMessage('');
    setPhone('');
  };

  const handleRefreshQR = async () => {
    setMessage('Atualizando QR Code...');
    await fetchQR();
  };

  // ── render ──────────────────────────────────────────────────
  const statusInfo = {
    idle:       { color: '#9ca3af', icon: 'fa-circle',               label: 'Desconectado'    },
    connecting: { color: '#3b82f6', icon: 'fa-spinner fa-spin',       label: 'Conectando...'   },
    qrcode:     { color: '#eab308', icon: 'fa-qrcode',                label: 'Aguardando scan' },
    connected:  { color: '#22c55e', icon: 'fa-check-circle',          label: 'Conectado'       },
    error:      { color: '#ef4444', icon: 'fa-exclamation-circle',    label: 'Erro'            },
  }[phase] || {};

  const { Button: Btn } = window.ENVOXIntelligenceDesignSystem_daebe7;

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Conexão WhatsApp"
        subtitle="Gerencie a conexão do número WhatsApp desta conta"
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'flex-start' }}>

        {/* Status Card */}
        <DsCard style={{ width: '100%', maxWidth: '560px', animation: 'fadeInUp 0.35s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '9999px', background: statusInfo.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={'fas ' + statusInfo.icon} style={{ color: statusInfo.color, fontSize: '18px' }}></i>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                Status: {statusInfo.label}
              </div>
              {phone && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Número: {phone}
                </div>
              )}
              {message && phase !== 'connected' && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {message}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {(phase === 'idle' || phase === 'error') && (
              <Btn variant="success" onClick={handleConnect}>
                <i className="fas fa-plug"></i>&nbsp; Conectar WhatsApp
              </Btn>
            )}
            {phase === 'connected' && (
              <Btn variant="danger" onClick={handleDisconnect}>
                <i className="fas fa-unlink"></i>&nbsp; Desconectar
              </Btn>
            )}
            {phase === 'qrcode' && (
              <>
                <Btn variant="secondary" onClick={handleRefreshQR}>
                  <i className="fas fa-sync-alt"></i>&nbsp; Novo QR Code
                </Btn>
                <Btn variant="ghost" onClick={handleDisconnect}>Cancelar</Btn>
              </>
            )}
          </div>
        </DsCard>

        {/* QR Code */}
        {phase === 'qrcode' && qrSrc && (
          <DsCard style={{ maxWidth: '360px', animation: 'fadeInUp 0.4s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: '#374151', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-qrcode" style={{ color: 'var(--color-brand-600)' }}></i>
              Escaneie com o WhatsApp
            </div>
            <div style={{ padding: '12px', background: 'white', borderRadius: 'var(--radius-xl)', border: '2px solid var(--color-border-card)', boxShadow: 'var(--shadow-sm)' }}>
              <img src={qrSrc} alt="QR Code WhatsApp"
                style={{ width: '240px', height: '240px', display: 'block', imageRendering: 'pixelated' }}
              />
            </div>
            <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#854d0e', lineHeight: 1.5 }}>
              <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
              Abra o WhatsApp no número dedicado → <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong> → escaneie este QR.
              <br/>O QR renova automaticamente a cada 5s.
            </div>
          </DsCard>
        )}

        {/* Connected */}
        {phase === 'connected' && (
          <DsCard style={{ maxWidth: '560px', animation: 'fadeInUp 0.4s ease', textAlign: 'center', padding: '40px 24px' }}>
            <i className="fas fa-check-circle" style={{ fontSize: '48px', color: '#22c55e', display: 'block', marginBottom: '16px' }}></i>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
              WhatsApp Conectado!
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              O sistema está recebendo mensagens dos grupos. Os alertas aparecerão automaticamente no Dashboard.
            </div>
          </DsCard>
        )}

        {/* Instruções */}
        {phase === 'idle' && (
          <DsCard style={{ maxWidth: '560px', animation: 'fadeInUp 0.4s ease 0.1s both' }}>
            <SectionTitle icon="info-circle" label="Como funciona" color="#3b82f6" />
            <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Clique em "Conectar WhatsApp"',
                'Um QR Code será exibido na tela',
                'Abra o WhatsApp do número dedicado desta conta',
                'Vá em Dispositivos conectados → Conectar dispositivo',
                'Escaneie o QR Code',
                'Pronto — mensagens dos grupos chegam em tempo real',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  {step}
                </li>
              ))}
            </ol>
          </DsCard>
        )}

        {/* Info sessão */}
        {session && (
          <DsCard style={{ maxWidth: '560px', padding: '14px 20px', animation: 'fadeInUp 0.4s ease 0.2s both' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span><i className="fas fa-tag" style={{ marginRight: '6px' }}></i>Sessão: <strong>{session}</strong></span>
            </div>
          </DsCard>
        )}

      </div>
    </div>
  );
}

Object.assign(window, { WppConnectionScreen });
