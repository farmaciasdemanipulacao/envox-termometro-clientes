// tc-shared.jsx — Sidebar, PageHeader, TemperatureGauge, SectionTitle, DsCard, Spinner, Toast

// Extrai UMA VEZ todos os componentes do DS e expõe globalmente via window
// Os outros arquivos JSX NÃO devem redeclarar — usam window.DS_Button etc.
(function() {
  var _ds = window.ENVOXIntelligenceDesignSystem_daebe7 || {};
  window.DS_Button    = _ds.Button    || null;
  window.DS_KPICard   = _ds.KPICard   || null;
  window.DS_AlertItem = _ds.AlertItem || null;
  window.DS_GroupCard = _ds.GroupCard || null;
})();

// Alias local curto (var, não const — não conflita entre arquivos Babel)
var Button    = window.DS_Button;
var KPICard   = window.DS_KPICard;
var AlertItem = window.DS_AlertItem;
var GroupCard = window.DS_GroupCard;

// ── Mobile detection hook ─────────────────────────────────────
function useIsMobile() {
  var [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(function() {
    var handler = function() { setIsMobile(window.innerWidth < 768); };
    window.addEventListener('resize', handler);
    return function() { window.removeEventListener('resize', handler); };
  }, []);
  return isMobile;
}

// ── Toast system ──────────────────────────────────────────────
window.showToast = function(message, type = 'info') {
  const colors = { success: '#16a34a', error: '#dc2626', info: '#2563eb', warning: '#d97706' };
  const icons  = { success: 'check-circle', error: 'times-circle', info: 'info-circle', warning: 'exclamation-triangle' };
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:${16 + document.querySelectorAll('.toast-item').length * 60}px;right:16px;z-index:9999;
    background:${colors[type]};color:white;padding:12px 18px;border-radius:10px;font-size:14px;
    display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.2);
    animation:fadeInUp 0.3s ease;max-width:360px;font-family:var(--font-sans);`;
  el.className = 'toast-item';
  el.innerHTML = `<i class="fas fa-${icons[type]}"></i> ${message}`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 4000);
};

// ── API helpers ───────────────────────────────────────────────
var API_BASE = '/api/v1';

window.getToken = () => localStorage.getItem('envox_token') || '';

window.apiGet = async function(path) {
  const r = await fetch(API_BASE + path, { headers: { Authorization: 'Bearer ' + window.getToken() } });
  if (r.status === 401) { window.doLogout && window.doLogout(); throw new Error('Sessão expirada'); }
  if (!r.ok) throw new Error('API error: ' + r.status);
  return r.json();
};

async function _apiError(r) {
  try { const d = await r.json(); throw new Error(d.detail || ('API error: ' + r.status)); }
  catch(e) { if (e.message !== 'API error: ' + r.status) throw e; throw new Error('API error: ' + r.status); }
}

window.apiPost = async function(path, body = {}) {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + window.getToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) await _apiError(r);
  return r.json();
};

window.apiPatch = async function(path, body = {}) {
  const r = await fetch(API_BASE + path, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + window.getToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) await _apiError(r);
  return r.json();
};

window.apiPut = async function(path, body = {}) {
  const r = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + window.getToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) await _apiError(r);
  return r.json();
};

window.apiDelete = async function(path) {
  const r = await fetch(API_BASE + path, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + window.getToken() },
  });
  if (!r.ok) await _apiError(r);
  return r.status === 204 ? null : r.json();
};

// ── Sidebar ───────────────────────────────────────────────────
function useWppStatus() {
  const [status, setStatus] = React.useState(null); // null=loading, true=connected, false=disconnected
  React.useEffect(() => {
    const check = () => {
      fetch('/api/v1/tenant/wpp/status', { headers: { Authorization: 'Bearer ' + window.getToken() } })
        .then(r => r.ok ? r.json() : null)
        .then(d => setStatus(d ? d.connected : false))
        .catch(() => setStatus(false));
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);
  return status;
}

function Sidebar({ activePage, onNavigate, alertsCount, company, userName, isAdmin, onLogout, onOpenProfile }) {
  const [hovered, setHovered] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const wppConnected = useWppStatus();

  const navItems = [
    { id: 'dashboard',     icon: 'tachometer-alt', label: 'Visão Geral' },
    { id: 'intelligence',  icon: 'bolt',           label: 'Inteligência Operacional' },
    { id: 'tags',          icon: 'tags',           label: 'Relatório de Tags' },
    { id: 'summary',       icon: 'file-alt',       label: 'Resumo Executivo' },
    { id: 'alerts',        icon: 'bell',            label: 'Alertas', badge: alertsCount },
    { id: 'wpp-groups',    icon: 'users',           label: 'Grupos WhatsApp' },
    { id: 'range-summary', icon: 'calendar-alt',   label: 'Resumo por Período' },
    { id: 'custom-analysis', icon: 'wand-magic-sparkles', label: 'Análise Personalizada' },
    { id: 'agent',         icon: 'robot',          label: 'Agente Virtual' },
    { id: 'email',         icon: 'envelope',        label: 'E-mails' },
    { id: 'team',          icon: 'user-tie',        label: 'Time' },
  ];
  const sysItems = [
    { id: 'wpp',     icon: 'whatsapp fab',  label: 'Conexão WhatsApp' },
    { id: 'config',  icon: 'cog',           label: 'Configurações'   },
    { id: 'api',     icon: 'code',          label: 'API Docs'        },
    ...(isAdmin ? [
      { id: 'admin', icon: 'shield-halved', label: 'Painel Administrativo' },
      { id: 'automations', icon: 'gears',   label: 'Automações do Sistema' },
    ] : []),
  ];

  const itemStyle = (id) => ({
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 16px', borderRadius: 'var(--radius-lg)',
    background: activePage === id ? 'var(--color-brand-600)' : hovered === id ? '#374151' : 'transparent',
    color: activePage === id ? 'white' : '#d1d5db',
    cursor: 'pointer', transition: 'background 0.15s ease', userSelect: 'none',
  });

  return (
    <aside style={{
      width: 'var(--sidebar-width)', background: 'var(--color-bg-sidebar)',
      display: 'flex', flexDirection: 'column',
      boxShadow: 'var(--shadow-sidebar)', flexShrink: 0,
    }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid #374151' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/atenx_assets/web/atenx-mark-96.png" alt="ATENX" style={{ width: '40px', height: '40px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'white', fontSize: 'var(--text-lg)', lineHeight: 1.15 }}>{company}</div>
            <div style={{ color: 'var(--color-brand-400)', fontSize: 'var(--text-xs)' }}>by Envox</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {navItems.map(item => (
          <div key={item.id} style={itemStyle(item.id)}
            onClick={() => onNavigate(item.id)}
            onMouseEnter={() => setHovered(item.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <i className={`fas fa-${item.icon}`} style={{ width: '18px', textAlign: 'center', fontSize: '14px' }}></i>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: activePage === item.id ? 500 : 400, flex: 1 }}>{item.label}</span>
            {item.badge > 0 && (
              <span style={{ background: '#ef4444', color: 'white', fontSize: '11px', borderRadius: '9999px', minWidth: '18px', height: '18px', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </div>
        ))}

        <div style={{ borderTop: '1px solid #374151', margin: '10px 4px' }}></div>
        <div style={{ fontSize: '11px', color: '#6b7280', padding: '2px 16px', textTransform: 'uppercase', letterSpacing: '.07em' }}>Sistema</div>
        {sysItems.map(item => {
          const iconClass = item.icon === 'whatsapp fab' ? 'fab fa-whatsapp' : `fas fa-${item.icon}`;
          const isWpp = item.id === 'wpp';
          return (
            <div key={item.id} style={itemStyle(item.id)}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <i className={iconClass} style={{ width: '18px', textAlign: 'center', fontSize: '14px' }}></i>
              <span style={{ fontSize: 'var(--text-sm)', flex: 1 }}>{item.label}</span>
              {isWpp && wppConnected !== null && (
                <span title={wppConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'} style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: wppConnected ? '#22c55e' : '#ef4444',
                  boxShadow: wppConnected ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
                }}></span>
              )}
            </div>
          );
        })}

        {/* Banner WhatsApp desconectado */}
        {wppConnected === false && (
          <div onClick={() => onNavigate('wpp')} style={{
            marginTop: '6px', padding: '8px 12px', borderRadius: '8px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <i className="fab fa-whatsapp" style={{ color: '#f87171', fontSize: '14px' }}></i>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#f87171' }}>WhatsApp desconectado</div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>Clique para reconectar</div>
            </div>
          </div>
        )}
      </nav>

      {/* User section com popover */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #374151', position: 'relative' }}>
        {/* Popover menu */}
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 198 }} />
            <div style={{
              position: 'absolute', bottom: '64px', left: '12px', right: '12px',
              background: '#1f2937', border: '1px solid #374151', borderRadius: '12px',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)', zIndex: 199,
              overflow: 'hidden', animation: 'fadeInUp 0.18s ease',
            }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #374151' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: '#6b7280', marginTop: '1px' }}>{isAdmin ? 'Super Admin' : 'Usuário'}</div>
              </div>
              {[
                { icon: 'user-circle', label: 'Meu Perfil', action: () => { setMenuOpen(false); onOpenProfile && onOpenProfile(); } },
                ...(isAdmin ? [{ icon: 'users-cog', label: 'Gerenciar Usuários', action: () => { setMenuOpen(false); onNavigate('users'); } }] : []),
                { icon: 'cog', label: 'Configurações', action: () => { setMenuOpen(false); onNavigate('config'); } },
              ].map((item, i) => (
                <div key={i} onClick={item.action} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '11px 14px', cursor: 'pointer', color: '#d1d5db', fontSize: 'var(--text-sm)',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#374151'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <i className={`fas fa-${item.icon}`} style={{ width: '16px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}></i>
                  {item.label}
                </div>
              ))}
              <div style={{ borderTop: '1px solid #374151' }} />
              <div onClick={() => { setMenuOpen(false); onLogout(); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '11px 14px', cursor: 'pointer', color: '#f87171', fontSize: 'var(--text-sm)',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#374151'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <i className="fas fa-sign-out-alt" style={{ width: '16px', textAlign: 'center', fontSize: '13px' }}></i>
                Sair
              </div>
            </div>
          </>
        )}

        {/* User avatar clicável */}
        <div
          onClick={() => setMenuOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 8px', borderRadius: 'var(--radius-lg)', transition: 'background 0.15s', userSelect: 'none' }}
          onMouseEnter={e => e.currentTarget.style.background = '#374151'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: '32px', height: '32px', background: 'var(--color-brand-600)', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <i className="fas fa-user" style={{ color: 'white', fontSize: '12px' }}></i>
            {isAdmin && (
              <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '12px', height: '12px', background: '#f59e0b', borderRadius: '9999px', border: '2px solid var(--color-bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-star" style={{ fontSize: '6px', color: 'white' }}></i>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: '#6b7280' }}>{isAdmin ? 'Super Admin' : 'Usuário'}</div>
          </div>
          <i className={`fas fa-chevron-${menuOpen ? 'down' : 'up'}`} style={{ color: '#6b7280', fontSize: '11px', transition: 'transform 0.2s' }}></i>
        </div>
      </div>
    </aside>
  );
}

// ── MobileTopBar ──────────────────────────────────────────────
function MobileTopBar({ company, onMenuOpen }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
      background: 'var(--color-bg-sidebar)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src="/atenx_assets/web/atenx-mark-96.png" alt="ATENX" style={{ width: '32px', height: '32px', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, color: 'white', fontSize: '15px', lineHeight: 1.15 }}>{company}</div>
          <div style={{ color: 'var(--color-brand-400)', fontSize: '11px' }}>by Envox</div>
        </div>
      </div>
      <div onClick={onMenuOpen} style={{ cursor: 'pointer', padding: '10px', color: '#d1d5db' }}>
        <i className="fas fa-bars" style={{ fontSize: '18px' }}></i>
      </div>
    </div>
  );
}

// ── BottomNav ─────────────────────────────────────────────────
function BottomNav({ activePage, onNavigate, alertsCount, onMoreOpen }) {
  var mainTabs = [
    { id: 'dashboard',    icon: 'tachometer-alt', label: 'Painel' },
    { id: 'intelligence', icon: 'bolt',           label: 'Intel' },
    { id: 'alerts',       icon: 'bell',           label: 'Alertas', badge: alertsCount },
    { id: 'email',        icon: 'envelope',       label: 'E-mails' },
  ];
  return (
    <div className="bottom-nav-safe" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--color-bg-sidebar)', borderTop: '1px solid #374151',
      display: 'flex', alignItems: 'stretch', zIndex: 100, minHeight: '60px',
    }}>
      {mainTabs.map(function(tab) {
        var isActive = activePage === tab.id;
        return (
          <div key={tab.id}
            onClick={function() { onNavigate(tab.id); }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '3px', cursor: 'pointer', padding: '8px 0', position: 'relative',
              color: isActive ? 'var(--color-brand-400)' : '#6b7280',
              background: isActive ? 'rgba(14,165,233,0.08)' : 'transparent',
            }}
          >
            <div style={{ position: 'relative' }}>
              <i className={'fas fa-' + tab.icon} style={{ fontSize: '18px' }}></i>
              {tab.badge > 0 && (
                <span style={{
                  position: 'absolute', top: '-5px', right: '-9px',
                  background: '#ef4444', color: 'white', fontSize: '10px',
                  borderRadius: '9999px', minWidth: '16px', height: '16px',
                  padding: '0 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                }}>
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
          </div>
        );
      })}
      <div
        onClick={onMoreOpen}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '3px', cursor: 'pointer', padding: '8px 0', color: '#6b7280',
        }}
      >
        <i className="fas fa-ellipsis-h" style={{ fontSize: '18px' }}></i>
        <span style={{ fontSize: '10px' }}>Mais</span>
      </div>
    </div>
  );
}

// ── MobileDrawer ──────────────────────────────────────────────
function MobileDrawer({ open, activePage, onNavigate, onClose, alertsCount, company, userName, isAdmin, onLogout, onOpenProfile }) {
  if (!open) return null;
  const wppConnected = useWppStatus();
  var allItems = [
    { id: 'dashboard',    icon: 'tachometer-alt', label: 'Visão Geral' },
    { id: 'intelligence', icon: 'bolt',           label: 'Inteligência Operacional' },
    { id: 'tags',         icon: 'tags',           label: 'Relatório de Tags' },
    { id: 'summary',      icon: 'file-alt',       label: 'Resumo Executivo' },
    { id: 'alerts',       icon: 'bell',           label: 'Alertas', badge: alertsCount },
    { id: 'wpp-groups',   icon: 'users',          label: 'Grupos WhatsApp' },
    { id: 'range-summary', icon: 'calendar-week', label: 'Resumo por Período' },
    { id: 'custom-analysis', icon: 'wand-magic-sparkles', label: 'Análise Personalizada' },
    { id: 'agent',        icon: 'robot',          label: 'Agente Virtual' },
    { id: 'email',        icon: 'envelope',       label: 'E-mails' },
    { id: 'team',         icon: 'user-tie',       label: 'Time' },
  ];
  var sysItems = [
    { id: 'wpp',    icon: 'whatsapp fab',  label: 'Conexão WhatsApp' },
    { id: 'config', icon: 'cog',           label: 'Configurações' },
    { id: 'api',    icon: 'code',          label: 'API Docs' },
  ];
  if (isAdmin) {
    sysItems.splice(1, 0, { id: 'users', icon: 'users-cog', label: 'Gerenciar Usuários' });
    sysItems.push({ id: 'admin', icon: 'shield-halved', label: 'Painel Administrativo' });
    sysItems.push({ id: 'automations', icon: 'gears', label: 'Automações do Sistema' });
  }

  var itemStyle = function(id) { return {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '13px 16px', borderRadius: 'var(--radius-lg)',
    background: activePage === id ? 'var(--color-brand-600)' : 'transparent',
    color: activePage === id ? 'white' : '#d1d5db',
    cursor: 'pointer', fontSize: '15px',
  }; };
  return (
    <div>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }}></div>
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: '85vw', maxWidth: '320px',
        background: 'var(--color-bg-sidebar)', zIndex: 201, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInLeft 0.22s ease',
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/atenx_assets/web/atenx-mark-96.png" alt="ATENX" style={{ width: '36px', height: '36px', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, color: 'white', fontSize: 'var(--text-lg)' }}>{company}</div>
              <div style={{ color: 'var(--color-brand-400)', fontSize: '11px' }}>by Envox</div>
            </div>
          </div>
          <div onClick={onClose} style={{ cursor: 'pointer', padding: '8px', color: '#9ca3af' }}>
            <i className="fas fa-times" style={{ fontSize: '18px' }}></i>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {allItems.map(function(item) {
            return (
              <div key={item.id} style={itemStyle(item.id)} onClick={function() { onNavigate(item.id); }}>
                <i className={'fas fa-' + item.icon} style={{ width: '20px', textAlign: 'center' }}></i>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', fontSize: '11px', borderRadius: '9999px', minWidth: '18px', height: '18px', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid #374151', margin: '10px 4px' }}></div>
          <div style={{ fontSize: '11px', color: '#6b7280', padding: '2px 16px', textTransform: 'uppercase', letterSpacing: '.07em' }}>Sistema</div>
          {sysItems.map(function(item) {
            var iconClass = item.icon === 'whatsapp fab' ? 'fab fa-whatsapp' : 'fas fa-' + item.icon;
            var isWpp = item.id === 'wpp';
            return (
              <div key={item.id} style={itemStyle(item.id)} onClick={function() { onNavigate(item.id); }}>
                <i className={iconClass} style={{ width: '20px', textAlign: 'center' }}></i>
                <span style={{ flex: 1 }}>{item.label}</span>
                {isWpp && wppConnected !== null && (
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: wppConnected ? '#22c55e' : '#ef4444', boxShadow: wppConnected ? '0 0 6px #22c55e' : '0 0 6px #ef4444' }}></span>
                )}
              </div>
            );
          })}
          {wppConnected === false && (
            <div onClick={function() { onNavigate('wpp'); }} style={{ marginTop: '6px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fab fa-whatsapp" style={{ color: '#f87171', fontSize: '14px' }}></i>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#f87171' }}>WhatsApp desconectado</div>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>Toque para reconectar</div>
              </div>
            </div>
          )}
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid #374151' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--color-brand-600)', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-user" style={{ color: 'white', fontSize: '14px' }}></i>
              </div>
              {isAdmin && (
                <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '14px', height: '14px', background: '#f59e0b', borderRadius: '9999px', border: '2px solid var(--color-bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-star" style={{ fontSize: '7px', color: 'white' }}></i>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: '#6b7280' }}>{isAdmin ? 'Super Admin' : 'Usuário'}</div>
            </div>
            <div onClick={onOpenProfile} title="Meu Perfil" style={{ cursor: 'pointer', padding: '8px', color: '#9ca3af' }}>
              <i className="fas fa-user-circle" style={{ fontSize: '16px' }}></i>
            </div>
            <div onClick={onLogout} title="Sair" style={{ cursor: 'pointer', padding: '8px', color: '#6b7280' }}>
              <i className="fas fa-sign-out-alt" style={{ fontSize: '16px' }}></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────
function PageHeader({ title, subtitle, actions }) {
  var isMobile = useIsMobile();
  return (
    <header style={{
      background: 'var(--color-neutral-900)',
      borderBottom: '1px solid var(--color-neutral-800)',
      padding: isMobile ? '10px 16px' : '14px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{ fontSize: isMobile ? 'var(--text-base)' : 'var(--text-xl)', fontWeight: 700, color: '#e9edef', lineHeight: 1.2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
        {subtitle && !isMobile && <p style={{ fontSize: 'var(--text-sm)', color: '#8696a0', margin: '2px 0 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>{actions}</div>}
    </header>
  );
}

// ── TemperatureGauge ──────────────────────────────────────────
function TemperatureGauge({ score, size }) {
  size = size || 128;
  const arc = 276.46;
  const fill = (score / 100) * arc * 0.75;
  const color = score >= 81 ? '#22c55e' : score >= 61 ? '#0d9488' : score >= 41 ? '#eab308' : score >= 21 ? '#f97316' : '#ef4444';
  const gaugeDash = fill.toFixed(2) + ' ' + arc;
  const lm = score >= 81
    ? { text: '🟢 Excelente', bg: '#dcfce7', color: '#166534' }
    : score >= 61 ? { text: '🟢 Bom',      bg: '#ccfbf1', color: '#0f766e' }
    : score >= 41 ? { text: '🟡 Atenção',  bg: '#fef9c3', color: '#854d0e' }
    : score >= 21 ? { text: '🟠 Alerta',   bg: '#ffedd5', color: '#9a3412' }
    :               { text: '🔴 Crítico',   bg: '#fee2e2', color: '#991b1b' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size + 'px', height: size + 'px', marginBottom: '12px' }}>
        <svg width={size} height={size} viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="44" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" strokeDasharray="207.35 276.46" strokeDashoffset="-34.56" />
          <circle cx="48" cy="48" r="44" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={gaugeDash} strokeDashoffset="-34.56" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>/ 100</span>
        </div>
      </div>
      <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 500, background: lm.bg, color: lm.color }}>
        {lm.text}
      </span>
    </div>
  );
}

// ── SectionTitle ──────────────────────────────────────────────
function SectionTitle({ icon, label, color }) {
  color = color || 'var(--color-brand-600)';
  return (
    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-lg)', fontWeight: 700, color: '#1f2937', margin: '0 0 16px 0' }}>
      <i className={'fas fa-' + icon} style={{ color: color }}></i>
      {label}
    </h2>
  );
}

// ── DsCard ────────────────────────────────────────────────────
function DsCard({ children, style }) {
  return (
    <div style={Object.assign({ background: 'white', borderRadius: 'var(--radius-xl)', padding: '24px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-card)' }, style || {})}>
      {children}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner({ size, color }) {
  size = size || 14; color = color || 'white';
  return (
    <span style={{ display: 'inline-block', width: size + 'px', height: size + 'px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
  );
}

Object.assign(window, { useIsMobile, Sidebar, MobileTopBar, BottomNav, MobileDrawer, PageHeader, TemperatureGauge, SectionTitle, DsCard, Spinner, Button, KPICard, AlertItem, GroupCard });
