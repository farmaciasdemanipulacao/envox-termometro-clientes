// tc-public.jsx — Landing page de preços + fluxo de cadastro SaaS

// ── Landing / Pricing ────────────────────────────────────────
function PricingPage({ onSelectPlan, onLogin }) {
  const [plans, setPlans]     = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/v1/plans')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPlans(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusColor = { active: '#16a34a', trial: '#d97706', cancelled: 'var(--color-critical)', expired: '#6b7280' };

  const formatPrice = (p) => p === 0 ? 'Gratuito' : `R$ ${p.toFixed(0).replace('.', ',')}/mês`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-page)', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <header style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/atenx_assets/web/atenx-mark-96.png" alt="ATENX" style={{ width: '40px', height: '40px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '16px' }}>ATENX</div>
            <div style={{ fontSize: '11px', color: 'var(--color-brand-600)', fontWeight: 600 }}>by Envox</div>
          </div>
        </div>
        <button
          onClick={onLogin}
          style={{ background: 'rgba(13,148,136,0.15)', border: '1px solid var(--color-brand-600)', color: 'var(--color-brand-600)', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
        >
          Já tenho conta
        </button>
      </header>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: 'clamp(48px, 10vw, 80px) 24px 48px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '24px' }}>
          <i className="fas fa-bolt" style={{ color: 'var(--color-brand-600)', fontSize: '12px' }} />
          <span style={{ color: 'var(--color-brand-600)', fontSize: '12px', fontWeight: 600 }}>Monitoramento inteligente de WhatsApp</span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.2, margin: '0 0 16px 0' }}>
          Transforme seus grupos<br />
          <span style={{ color: 'var(--color-brand-600)' }}>em inteligência de negócio</span>
        </h1>
        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--color-text-secondary)', maxWidth: '560px', margin: '0 auto 48px', lineHeight: 1.6 }}>
          Monitore conversas, detecte alertas críticos e gere resumos executivos com IA — tudo automaticamente.
        </p>
      </section>

      {/* Plans */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--color-text-primary)', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Escolha seu plano</h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '40px' }}>Sem fidelidade. Cancele quando quiser.</p>

        {loading ? (
          <SectionLoader padding="40px" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {plans.map(plan => (
              <PlanCard key={plan.id} plan={plan} onSelect={() => onSelectPlan(plan)} />
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '40px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '24px' }}>
          {[
            { icon: 'shield-alt', text: 'Seus dados são isolados — nenhum outro usuário acessa suas conversas' },
            { icon: 'credit-card', text: 'Pagamento seguro via Asaas' },
            { icon: 'headset', text: 'Suporte em português' },
          ].map(item => (
            <div key={item.icon} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              <i className={`fas fa-${item.icon}`} style={{ color: 'var(--color-brand-600)' }} />
              {item.text}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanCard({ plan, onSelect }) {
  const featured = plan.is_featured;
  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: `2px solid ${featured ? 'var(--color-brand-600)' : 'var(--color-border-card)'}`,
      borderRadius: '16px',
      padding: '28px 24px',
      position: 'relative',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(13,148,136,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {featured && (
        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--color-brand-600)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 16px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
          MAIS POPULAR
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--color-text-primary)', marginBottom: '6px' }}>{plan.name}</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{plan.description}</div>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          {plan.price_monthly === 0 ? 'Grátis' : `R$ ${plan.price_monthly.toFixed(0)}`}
        </span>
        {plan.price_monthly > 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>/mês</span>}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(plan.features || []).map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            <i className="fas fa-check" style={{ color: 'var(--color-brand-600)', marginTop: '2px', flexShrink: 0 }} />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
          background: featured ? 'var(--color-brand-600)' : 'rgba(13,148,136,0.15)',
          color: featured ? '#fff' : 'var(--color-brand-600)',
          fontWeight: 700, fontSize: '15px', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-brand-700)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.background = featured ? 'var(--color-brand-600)' : 'rgba(13,148,136,0.15)'; e.currentTarget.style.color = featured ? '#fff' : 'var(--color-brand-600)'; }}
      >
        Começar agora
      </button>
    </div>
  );
}

// ── Registration Flow ─────────────────────────────────────────
function RegisterFlow({ initialPlan, onSuccess, onBack }) {
  const [step, setStep]       = React.useState(initialPlan ? 2 : 1);
  const [plans, setPlans]     = React.useState([]);
  const [selPlan, setSelPlan] = React.useState(initialPlan || null);
  const [form, setForm]       = React.useState({ full_name: '', email: '', username: '', password: '', confirm: '', company_name: '', phone: '' });
  const [errors, setErrors]   = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState('');

  React.useEffect(() => {
    fetch('/api/v1/plans')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setPlans(data);
        if (!selPlan && data.length) setSelPlan(data[0]);
      })
      .catch(() => {});
  }, []);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function validateStep2() {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Nome obrigatório';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'E-mail inválido';
    if (!form.username.trim() || form.username.length < 3) e.username = 'Mínimo 3 caracteres';
    if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) e.username = 'Apenas letras, números, _ e -';
    if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    if (form.password !== form.confirm) e.confirm = 'Senhas não coincidem';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    setApiError('');
    setLoading(true);
    try {
      const body = {
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        company_name: form.company_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        plan_slug: selPlan?.slug || 'starter',
      };
      const r = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { setApiError(data.detail || 'Erro ao criar conta'); return; }
      localStorage.setItem('envox_token', data.access_token);
      localStorage.setItem('envox_user', data.username);
      localStorage.setItem('envox_plan_name', data.plan_name || '');
      onSuccess({ userName: data.username, isAdmin: data.is_admin, userId: data.user_id, fullName: data.full_name, planName: data.plan_name || '' });
    } catch (err) {
      setApiError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const inp = (label, key, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>{label}</label>
      <input
        type={type} value={form[key]} placeholder={placeholder}
        onChange={e => { setField(key, e.target.value); setErrors(prev => ({ ...prev, [key]: '' })); }}
        style={{
          width: '100%', padding: '10px 12px', boxSizing: 'border-box',
          background: 'var(--color-bg-card)', border: `1px solid ${errors[key] ? 'var(--color-critical)' : 'var(--color-border-card)'}`,
          borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '14px', outline: 'none',
        }}
      />
      {errors[key] && <div style={{ color: 'var(--color-critical)', fontSize: '12px', marginTop: '4px' }}>{errors[key]}</div>}
    </div>
  );

  const steps = ['Plano', 'Dados', 'Confirmação'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-page)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      {/* Top bar */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border-card)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '20px', padding: '4px 8px' }}>
          <i className="fas fa-arrow-left" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--color-brand-600)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '14px' }}>E</div>
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '15px' }}>Criar conta</span>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0', padding: '24px 24px 0' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step > i + 1 ? 'var(--color-brand-600)' : step === i + 1 ? 'var(--color-brand-600)' : 'var(--color-bg-card)',
                border: `2px solid ${step >= i + 1 ? 'var(--color-brand-600)' : 'var(--color-border-default)'}`,
                color: step >= i + 1 ? '#fff' : 'var(--color-text-muted)',
                fontSize: '13px', fontWeight: 700,
              }}>
                {step > i + 1 ? <i className="fas fa-check" style={{ fontSize: '12px' }} /> : i + 1}
              </div>
              <span style={{ fontSize: '11px', color: step >= i + 1 ? 'var(--color-brand-600)' : 'var(--color-text-placeholder)', fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: '60px', height: '2px', background: step > i + 1 ? 'var(--color-brand-600)' : 'var(--color-bg-card)', margin: '0 4px', marginBottom: '20px' }} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '24px', overflow: 'auto' }}>
        <div style={{ width: '100%', maxWidth: step === 1 ? '960px' : '480px' }}>

          {/* Step 1 — Plan selection */}
          {step === 1 && (
            <div>
              <h2 style={{ color: 'var(--color-text-primary)', fontSize: '22px', fontWeight: 700, marginBottom: '6px', textAlign: 'center' }}>Escolha seu plano</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '28px', textAlign: 'center' }}>Todos os planos incluem 30 dias de uso — pagamento simulado por ora.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    onClick={() => setSelPlan(plan)}
                    style={{
                      background: selPlan?.id === plan.id ? 'rgba(13,148,136,0.12)' : 'var(--color-bg-card)',
                      border: `2px solid ${selPlan?.id === plan.id ? 'var(--color-brand-600)' : 'var(--color-border-card)'}`,
                      borderRadius: '14px', padding: '20px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
                    }}
                  >
                    {plan.is_featured && (
                      <div style={{ position: 'absolute', top: '-10px', right: '16px', background: 'var(--color-brand-600)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px' }}>POPULAR</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '17px' }}>{plan.name}</div>
                      <div style={{ fontWeight: 800, color: selPlan?.id === plan.id ? 'var(--color-brand-600)' : 'var(--color-text-primary)', fontSize: '20px' }}>
                        {plan.price_monthly === 0 ? 'Grátis' : `R$ ${plan.price_monthly.toFixed(0)}`}
                        {plan.price_monthly > 0 && <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-muted)' }}>/mês</span>}
                      </div>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {(plan.features || []).map((f, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                          <i className="fas fa-check" style={{ color: 'var(--color-brand-600)', fontSize: '11px', flexShrink: 0 }} />{f}
                        </li>
                      ))}
                    </ul>
                    {selPlan?.id === plan.id && (
                      <div style={{ position: 'absolute', top: '12px', left: '12px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-check" style={{ color: '#fff', fontSize: '10px' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => selPlan && setStep(2)}
                disabled={!selPlan}
                style={{ display: 'block', margin: '28px auto 0', padding: '13px 40px', background: 'var(--color-brand-600)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: selPlan ? 'pointer' : 'not-allowed', opacity: selPlan ? 1 : 0.5 }}
              >
                Continuar com {selPlan?.name} →
              </button>
            </div>
          )}

          {/* Step 2 — User data */}
          {step === 2 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ color: 'var(--color-text-primary)', fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Seus dados</h2>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '20px', padding: '4px 14px' }}>
                  <span style={{ color: 'var(--color-brand-600)', fontSize: '12px', fontWeight: 600 }}>{selPlan?.name} — R$ {selPlan?.price_monthly?.toFixed(0)}/mês</span>
                  <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}>mudar</button>
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '14px', padding: '24px' }}>
                {inp('Nome completo *', 'full_name', 'text', 'Seu nome')}
                {inp('E-mail *', 'email', 'email', 'voce@empresa.com')}
                {inp('Empresa', 'company_name', 'text', 'Nome da empresa (opcional)')}
                {inp('Telefone', 'phone', 'tel', '(11) 99999-9999 (opcional)')}
                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-card)', margin: '4px 0 14px' }} />
                {inp('Nome de usuário *', 'username', 'text', 'seunome (só letras, números, _ -)')}
                {inp('Senha *', 'password', 'password', 'Mínimo 6 caracteres')}
                {inp('Confirmar senha *', 'confirm', 'password', 'Repita a senha')}

                {apiError && (
                  <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid var(--color-critical)', borderRadius: '8px', padding: '10px 14px', color: 'var(--color-critical)', fontSize: '13px', marginBottom: '14px' }}>
                    <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }} />{apiError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '10px', color: 'var(--color-text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
                  ← Voltar
                </button>
                <button
                  onClick={() => { if (validateStep2()) { setApiError(''); setStep(3); } }}
                  style={{ flex: 2, padding: '12px', background: 'var(--color-brand-600)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirm + simulated payment */}
          {step === 3 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <h2 style={{ color: 'var(--color-text-primary)', fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Confirmar e ativar</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Revise e ative sua conta.</p>
              </div>

              {/* Summary card */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumo do pedido</div>
                {[
                  ['Plano', selPlan?.name],
                  ['Valor', `R$ ${selPlan?.price_monthly?.toFixed(2).replace('.', ',')}/mês`],
                  ['Nome', form.full_name],
                  ['E-mail', form.email],
                  ...(form.company_name ? [['Empresa', form.company_name]] : []),
                  ['Usuário', `@${form.username}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-card)' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{k}</span>
                    <span style={{ color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Simulated payment notice */}
              <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <i className="fas fa-info-circle" style={{ color: '#eab308', fontSize: '16px', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ color: '#fef08a', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Pagamento simulado</div>
                  <div style={{ color: '#a3a312', fontSize: '13px', lineHeight: 1.5 }}>
                    Sua conta será ativada imediatamente. A integração com o gateway de pagamento (Asaas) será habilitada em breve.
                  </div>
                </div>
              </div>

              {apiError && (
                <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid var(--color-critical)', borderRadius: '8px', padding: '10px 14px', color: 'var(--color-critical)', fontSize: '13px', marginBottom: '14px' }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }} />{apiError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: '13px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderRadius: '10px', color: 'var(--color-text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
                  ← Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{ flex: 2, padding: '13px', background: loading ? '#064e3b' : 'var(--color-brand-600)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {loading ? <><Spinner size={14} /> Criando conta...</> : <><i className="fas fa-rocket" /> Ativar minha conta</>}
                </button>
              </div>

              <p style={{ textAlign: 'center', color: 'var(--color-text-placeholder)', fontSize: '12px', marginTop: '16px' }}>
                Ao ativar, você concorda com os Termos de Uso e Política de Privacidade.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PricingPage, RegisterFlow, PlanCard });
