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

window.apiPost = async function(path, body = {}) {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + window.getToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('API error: ' + r.status);
  return r.json();
};

window.apiPatch = async function(path, body = {}) {
  const r = await fetch(API_BASE + path, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + window.getToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('API error: ' + r.status);
  return r.json();
};

window.apiPut = async function(path, body = {}) {
  const r = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + window.getToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('API error: ' + r.status);
  return r.json();
};

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ activePage, onNavigate, alertsCount, company, userName, onLogout }) {
  const [hovered, setHovered] = React.useState(null);

  const navItems = [
    { id: 'dashboard', icon: 'tachometer-alt', label: 'Visão Geral' },
    { id: 'summary',   icon: 'file-alt',       label: 'Resumo Executivo' },
    { id: 'alerts',    icon: 'bell',            label: 'Alertas', badge: alertsCount },
    { id: 'groups',    icon: 'users',           label: 'Grupos' },
    { id: 'team',      icon: 'user-tie',        label: 'Time' },
  ];
  const sysItems = [
    { id: 'wpp',     icon: 'whatsapp fab', label: 'Conexão WhatsApp' },
    { id: 'config',  icon: 'cog',          label: 'Configurações'   },
    { id: 'api',     icon: 'code',         label: 'API Docs'        },
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
          <div style={{ width: '40px', height: '40px', background: 'var(--color-brand-600)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-brain" style={{ color: 'white', fontSize: '18px' }}></i>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'white', fontSize: 'var(--text-lg)', lineHeight: 1.15 }}>{company}</div>
            <div style={{ color: 'var(--color-brand-400)', fontSize: 'var(--text-xs)' }}>Intelligence</div>
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
          return (
            <div key={item.id} style={itemStyle(item.id)}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <i className={iconClass} style={{ width: '18px', textAlign: 'center', fontSize: '14px' }}></i>
              <span style={{ fontSize: 'var(--text-sm)' }}>{item.label}</span>
            </div>
          );
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #374151' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--color-brand-600)', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-user" style={{ color: 'white', fontSize: '12px' }}></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: '#9ca3af' }}>{company}</div>
          </div>
          <i className="fas fa-sign-out-alt" onClick={onLogout} style={{ color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}></i>
        </div>
      </div>
    </aside>
  );
}

// ── PageHeader ────────────────────────────────────────────────
function PageHeader({ title, subtitle, actions }) {
  return (
    <header style={{ background: 'white', borderBottom: '1px solid var(--color-border-default)', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
      <div>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>{actions}</div>}
    </header>
  );
}

// ── TemperatureGauge ──────────────────────────────────────────
function TemperatureGauge({ score, size }) {
  size = size || 128;
  const arc = 276.46;
  const fill = (score / 100) * arc * 0.75;
  const color = score >= 81 ? '#22c55e' : score >= 61 ? '#3b82f6' : score >= 41 ? '#eab308' : score >= 21 ? '#f97316' : '#ef4444';
  const gaugeDash = fill.toFixed(2) + ' ' + arc;
  const lm = score >= 81
    ? { text: '🟢 Excelente', bg: '#dcfce7', color: '#166534' }
    : score >= 61 ? { text: '🔵 Bom',      bg: '#dbeafe', color: '#1e40af' }
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

Object.assign(window, { Sidebar, PageHeader, TemperatureGauge, SectionTitle, DsCard, Spinner, Button, KPICard, AlertItem, GroupCard });
