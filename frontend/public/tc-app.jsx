// tc-app.jsx — Main App com API real

function App() {
  const [loggedIn,  setLoggedIn]      = React.useState(!!localStorage.getItem('envox_token'));
  const [userName,  setUserName]      = React.useState(localStorage.getItem('envox_user') || 'Admin');
  const [page,      setPage]          = React.useState('dashboard');
  const [alertsCount, setAlertsCount] = React.useState(0);

  const company = 'ENVOX';

  // Registra logout global
  window.doLogout = handleLogout;

  // Carrega contagem de alertas periodicamente
  React.useEffect(() => {
    if (!loggedIn) return;
    const loadCount = () => {
      window.apiGet('/alerts?status=open&limit=1')
        .then(d => setAlertsCount(Array.isArray(d) ? d.length : 0))
        .catch(() => {});
      window.apiGet('/dashboard/overview')
        .then(d => setAlertsCount(d?.alerts?.open || 0))
        .catch(() => {});
    };
    loadCount();
    const iv = setInterval(loadCount, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loggedIn]);

  function handleLogin({ userName: u }) {
    setUserName(u || 'Admin');
    setLoggedIn(true);
  }

  function handleLogout() {
    localStorage.removeItem('envox_token');
    localStorage.removeItem('envox_user');
    setLoggedIn(false);
    setPage('dashboard');
  }

  function handleNavigate(newPage) {
    setPage(newPage);
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={handleLogin} company={company} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardScreen onNavigate={handleNavigate} onGenerateSummary={() => setPage('summary')} />;
      case 'summary':   return <SummaryScreen onNavigateAlerts={() => setPage('alerts')} />;
      case 'alerts':    return <AlertsScreen />;
      case 'groups':    return <GroupsScreen />;
      case 'team':      return <TeamScreen />;
      case 'wpp':       return <WppConnectionScreen />;
      case 'config':    return <ConfigScreen />;
      case 'api':       return <ApiDocsScreen />;
      default:          return <DashboardScreen onNavigate={handleNavigate} onGenerateSummary={() => setPage('summary')} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <Sidebar
        activePage={page}
        onNavigate={handleNavigate}
        alertsCount={alertsCount}
        company={company}
        userName={userName}
        onLogout={handleLogout}
      />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-page)' }}>
        {renderPage()}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
