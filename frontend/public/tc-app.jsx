// tc-app.jsx — Main App com API real

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

  const isMobile = useIsMobile();
  const company = 'ENVOX';

  // Registra logout global
  window.doLogout = handleLogout;

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
    setLoggedIn(false);
    setPage('dashboard');
  }

  function handleNavigate(newPage) {
    setPage(newPage);
    setDrawerOpen(false);
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={handleLogin} company={company} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':    return <DashboardScreen onNavigate={handleNavigate} onGenerateSummary={() => setPage('summary')} />;
      case 'intelligence': return <IntelligenceScreen onSelectGroup={g => { setSelectedGroup(g); setPage('conversation'); }} />;
      case 'tags':         return <TagsScreen onSelectGroup={g => { setSelectedGroup(g); setPage('conversation'); }} />;
      case 'summary':      return <SummaryScreen onNavigateAlerts={() => setPage('alerts')} />;
      case 'alerts':       return <AlertsScreen />;
      case 'groups':       return <GroupsScreen onSelectGroup={g => { setSelectedGroup(g); setPage('conversation'); }} />;
      case 'conversation': return selectedGroup
        ? <ConversationScreen group={selectedGroup} onBack={() => setPage('groups')} />
        : <GroupsScreen onSelectGroup={g => { setSelectedGroup(g); setPage('conversation'); }} />;
      case 'team':         return <TeamScreen />;
      case 'email':        return <EmailScreen onNavigateConfig={() => handleNavigate('config')} />;
      case 'wpp':          return <WppConnectionScreen />;
      case 'config':       return <ConfigScreen />;
      case 'api':          return <ApiDocsScreen />;
      case 'users':        return <UsersScreen onBack={() => setPage('config')} />;
      default:             return <DashboardScreen onNavigate={handleNavigate} onGenerateSummary={() => setPage('summary')} />;
    }
  };

  const displayName = userFullName || userName;

  if (isMobile) {
    return (
      <div style={{ height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)', background: 'var(--color-bg-page)' }}>
        <MobileTopBar company={company} onMenuOpen={() => setDrawerOpen(true)} />
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
