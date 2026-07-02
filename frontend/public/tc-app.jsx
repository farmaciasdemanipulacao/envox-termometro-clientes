// tc-app.jsx — Main App com API real

// ── Push Notification banner ───────────────────────────────────
function PushPermissionBanner({ onDismiss }) {
  const [loading, setLoading] = React.useState(false);
  const ph = window.pushHelpers;

  if (!ph || !ph.isSupported() || ph.getPermission() !== 'default') return null;

  async function handleEnable() {
    setLoading(true);
    try {
      const result = await ph.subscribe();
      if (result) {
        window.showToast && window.showToast('Notificações ativadas!', 'success');
      } else {
        window.showToast && window.showToast('Permissão negada ou não suportada.', 'warning');
      }
    } catch (e) {
      window.showToast && window.showToast('Erro ao ativar notificações.', 'error');
    } finally {
      setLoading(false);
      onDismiss();
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
      background: '#1e293b', border: '1px solid #0d9488', borderRadius: '12px',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      zIndex: 8000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      maxWidth: '420px', width: 'calc(100% - 32px)',
    }}>
      <i className="fas fa-bell" style={{ color: '#0d9488', fontSize: '20px', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>Ativar alertas no celular</div>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>Receba notificações de churn e urgência mesmo com o app fechado.</div>
      </div>
      <button
        onClick={handleEnable}
        disabled={loading}
        style={{
          background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px',
          padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          flexShrink: 0, opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '...' : 'Ativar'}
      </button>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', fontSize: '16px' }}
      >
        <i className="fas fa-times" />
      </button>
    </div>
  );
}

function InstallBanner({ onDismiss }) {
  const [loading, setLoading] = React.useState(false);

  async function handleInstall() {
    const prompt = window._installPrompt;
    if (!prompt) return;
    setLoading(true);
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window._installPrompt = null;
    setLoading(false);
    onDismiss();
  }

  return (
    <div style={{
      position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
      background: '#1e293b', border: '1px solid #0d9488', borderRadius: '12px',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      zIndex: 8001, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      maxWidth: '420px', width: 'calc(100% - 32px)',
    }}>
      <i className="fas fa-download" style={{ color: '#0d9488', fontSize: '20px', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>Instalar app</div>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>Adicione o ENVOX à tela inicial para acesso rápido em tela cheia.</div>
      </div>
      <button
        onClick={handleInstall}
        disabled={loading}
        style={{
          background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px',
          padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          flexShrink: 0, opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '...' : 'Instalar'}
      </button>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', fontSize: '16px' }}
      >
        <i className="fas fa-times" />
      </button>
    </div>
  );
}

function App() {
  const [loggedIn,      setLoggedIn]      = React.useState(!!localStorage.getItem('envox_token'));
  const [userName,      setUserName]      = React.useState(localStorage.getItem('envox_user') || 'Admin');
  const [userFullName,  setUserFullName]  = React.useState(localStorage.getItem('envox_full_name') || '');
  const [isAdmin,       setIsAdmin]       = React.useState(localStorage.getItem('envox_is_admin') === 'true');
  const [userId,        setUserId]        = React.useState(localStorage.getItem('envox_user_id') || '');
  const [page,          setPage]          = React.useState('dashboard');
  const [alertsCount,   setAlertsCount]   = React.useState(0);
  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [drawerOpen,    setDrawerOpen]    = React.useState(false);
  const [profileOpen,   setProfileOpen]   = React.useState(false);
  const [pushBanner,    setPushBanner]    = React.useState(false);
  const [installBanner, setInstallBanner] = React.useState(false);
  // Onboarding
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  // Fluxo público
  const [publicView,    setPublicView]    = React.useState('login');  // 'login' | 'pricing' | 'register'
  const [regPlan,       setRegPlan]       = React.useState(null);

  const isMobile = useIsMobile();
  const company = 'ENVOX';

  // Registra logout global
  window.doLogout = handleLogout;

  // Expõe navegação para o Service Worker
  window.envoxNavigate = (url) => { if (url === '/' || url.includes('alert')) handleNavigate('alerts'); };

  // Detecta novo usuário e exibe onboarding
  React.useEffect(() => {
    if (!loggedIn) return;
    if (localStorage.getItem('onboarding_completed')) return;
    // Verifica se tem grupos monitorados — se não, é novo usuário
    window.apiGet('/dashboard/groups')
      .then(d => {
        const groups = Array.isArray(d) ? d : (d?.groups || []);
        if (groups.length === 0) setShowOnboarding(true);
      })
      .catch(() => {});
  }, [loggedIn]);

  // Carrega perfil do usuário atual após login
  React.useEffect(() => {
    if (!loggedIn) return;
    window.apiGet('/users/me')
      .then(me => {
        setIsAdmin(me.is_admin);
        setUserId(me.id);
        setUserFullName(me.full_name || '');
        localStorage.setItem('envox_is_admin', String(me.is_admin));
        localStorage.setItem('envox_user_id', me.id);
        localStorage.setItem('envox_full_name', me.full_name || '');
      })
      .catch(() => {});
  }, [loggedIn]);

  // Mostra banner de push 3s após login (só se ainda não concedeu permissão)
  React.useEffect(() => {
    if (!loggedIn) return;
    const ph = window.pushHelpers;
    if (!ph || !ph.isSupported()) return;
    if (ph.getPermission() === 'default' && !sessionStorage.getItem('push_banner_dismissed')) {
      const t = setTimeout(() => setPushBanner(true), 3000);
      return () => clearTimeout(t);
    }
  }, [loggedIn]);

  // Mostra banner de instalação PWA quando o browser disparar o evento
  React.useEffect(() => {
    if (!loggedIn) return;
    if (sessionStorage.getItem('install_banner_dismissed')) return;
    // Evento pode ter chegado antes do React montar
    if (window._installPrompt) { setInstallBanner(true); return; }
    window._onInstallPromptReady = () => {
      if (!sessionStorage.getItem('install_banner_dismissed')) setInstallBanner(true);
    };
    return () => { window._onInstallPromptReady = null; };
  }, [loggedIn]);

  // Carrega contagem de alertas periodicamente
  React.useEffect(() => {
    if (!loggedIn) return;
    const loadCount = () => {
      window.apiGet('/dashboard/overview')
        .then(d => setAlertsCount(d?.alerts?.open || 0))
        .catch(() => {});
    };
    loadCount();
    const iv = setInterval(loadCount, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loggedIn]);

  function handleLogin({ userName: u, isAdmin: a, userId: uid, fullName: fn }) {
    setUserName(u || 'Admin');
    setIsAdmin(!!a);
    setUserId(uid || '');
    setUserFullName(fn || '');
    localStorage.setItem('envox_is_admin', String(!!a));
    localStorage.setItem('envox_user_id', uid || '');
    localStorage.setItem('envox_full_name', fn || '');
    setLoggedIn(true);
  }

  function handleLogout() {
    localStorage.removeItem('envox_token');
    localStorage.removeItem('envox_user');
    localStorage.removeItem('envox_is_admin');
    localStorage.removeItem('envox_user_id');
    localStorage.removeItem('envox_full_name');
    localStorage.removeItem('envox_plan_name');
    localStorage.removeItem('envox_max_history_days');
    localStorage.removeItem('envox_max_groups');
    setLoggedIn(false);
    setPage('dashboard');
  }

  function handleNavigate(newPage) {
    setPage(newPage);
    setDrawerOpen(false);
  }

  if (!loggedIn) {
    if (publicView === 'pricing') {
      return (
        <PricingPage
          onSelectPlan={plan => { setRegPlan(plan); setPublicView('register'); }}
          onLogin={() => setPublicView('login')}
        />
      );
    }
    if (publicView === 'register') {
      return (
        <RegisterFlow
          initialPlan={regPlan}
          onSuccess={handleLogin}
          onBack={() => setPublicView('pricing')}
        />
      );
    }
    // Default: login
    return (
      <LoginScreen
        onLogin={handleLogin}
        company={company}
        onCreateAccount={() => setPublicView('pricing')}
      />
    );
  }

  const renderPage = () => {
    if (page === 'admin') {
      return <AdminPanel onBack={() => setPage('dashboard')} />;
    }
    switch (page) {
      case 'dashboard':    return <DashboardScreen onNavigate={handleNavigate} onGenerateSummary={() => setPage('summary')} />;
      case 'intelligence': return <IntelligenceScreen onSelectGroup={g => { setSelectedGroup(g); setPage('conversation'); }} />;
      case 'tags':         return <TagsScreen onSelectGroup={g => { setSelectedGroup(g); setPage('conversation'); }} />;
      case 'summary':      return <SummaryScreen onNavigateAlerts={() => setPage('alerts')} />;
      case 'alerts':       return <AlertsScreen />;
      case 'groups':           return <WppGroupsManagerScreen onSelectGroup={g => { setSelectedGroup(g); setPage('wpp-conversation'); }} />;
      case 'conversation':     return selectedGroup
        ? <ConversationScreen group={selectedGroup} onBack={() => { setSelectedGroup(null); setPage('wpp-groups'); }} />
        : <WppGroupsManagerScreen onSelectGroup={g => { setSelectedGroup(g); setPage('wpp-conversation'); }} />;
      case 'wpp-groups':       return <WppGroupsManagerScreen onSelectGroup={g => { setSelectedGroup(g); setPage('wpp-conversation'); }} />;
      case 'wpp-conversation': return selectedGroup
        ? <ConversationScreen group={selectedGroup} onBack={() => { setSelectedGroup(null); setPage('wpp-groups'); }} />
        : <WppGroupsManagerScreen onSelectGroup={g => { setSelectedGroup(g); setPage('wpp-conversation'); }} />;
      case 'range-summary': return <RangeSummaryScreen />;
      case 'agent':        return <AgentConfigScreen />;
      case 'team':         return <TeamScreen />;
      case 'email':        return <EmailScreen onNavigateConfig={() => handleNavigate('config')} />;
      case 'wpp':          return <WppConnectionScreen />;
      case 'config':       return <ConfigScreen />;
      case 'api':          return <ApiDocsScreen />;
      case 'users':        return <UsersScreen onBack={() => setPage('config')} />;
      case 'automations':  return <AutomationsScreen />;
      default:             return <DashboardScreen onNavigate={handleNavigate} onGenerateSummary={() => setPage('summary')} />;
    }
  };

  const displayName = userFullName || userName;

  function handlePushDismiss() {
    sessionStorage.setItem('push_banner_dismissed', '1');
    setPushBanner(false);
  }

  function handleInstallDismiss() {
    sessionStorage.setItem('install_banner_dismissed', '1');
    setInstallBanner(false);
  }

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarding_completed', '1');
    setShowOnboarding(false);
  };

  if (isMobile) {
    return (
      <div style={{ height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)', background: 'var(--color-bg-page)' }}>
        {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
        <MobileTopBar company={company} onMenuOpen={() => setDrawerOpen(true)} />
        {installBanner && <InstallBanner onDismiss={handleInstallDismiss} />}
        {pushBanner && !installBanner && <PushPermissionBanner onDismiss={handlePushDismiss} />}
        <MobileDrawer
          open={drawerOpen}
          activePage={page}
          onNavigate={p => { handleNavigate(p); setDrawerOpen(false); }}
          onClose={() => setDrawerOpen(false)}
          alertsCount={alertsCount}
          company={company}
          userName={displayName}
          isAdmin={isAdmin}
          onLogout={handleLogout}
          onOpenProfile={() => { setDrawerOpen(false); setProfileOpen(true); }}
        />
        <main style={{
          position: 'absolute', top: '56px', bottom: '60px', left: 0, right: 0,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          background: 'var(--color-bg-page)',
        }}>
          {renderPage()}
        </main>
        <BottomNav
          activePage={page}
          onNavigate={handleNavigate}
          alertsCount={alertsCount}
          onMoreOpen={() => setDrawerOpen(true)}
        />
        {profileOpen && (
          <UserProfileModal
            onClose={() => setProfileOpen(false)}
            onSaved={(updated) => {
              if (updated.full_name !== undefined) {
                setUserFullName(updated.full_name || '');
                localStorage.setItem('envox_full_name', updated.full_name || '');
              }
              setProfileOpen(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      {installBanner && <InstallBanner onDismiss={handleInstallDismiss} />}
      {pushBanner && !installBanner && <PushPermissionBanner onDismiss={handlePushDismiss} />}
      <Sidebar
        activePage={page}
        onNavigate={handleNavigate}
        alertsCount={alertsCount}
        company={company}
        userName={displayName}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        onOpenProfile={() => setProfileOpen(true)}
      />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-page)' }}>
        {renderPage()}
      </main>
      {profileOpen && (
        <UserProfileModal
          onClose={() => setProfileOpen(false)}
          onSaved={(updated) => {
            if (updated.full_name !== undefined) {
              setUserFullName(updated.full_name || '');
              localStorage.setItem('envox_full_name', updated.full_name || '');
            }
            setProfileOpen(false);
          }}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
