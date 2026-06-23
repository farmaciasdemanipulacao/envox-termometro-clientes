/* @ds-bundle: {"format":3,"namespace":"ENVOXIntelligenceDesignSystem_daebe7","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"AlertItem","sourcePath":"components/data/AlertItem.jsx"},{"name":"GroupCard","sourcePath":"components/data/GroupCard.jsx"},{"name":"KPICard","sourcePath":"components/data/KPICard.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"349a74a4b3eb","components/core/Button.jsx":"91ad73770e8f","components/core/Card.jsx":"6f395dc119cb","components/data/AlertItem.jsx":"94d5b4bff14e","components/data/GroupCard.jsx":"66644cbccded","components/data/KPICard.jsx":"fd5fee9b6ea0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ENVOXIntelligenceDesignSystem_daebe7 = window.ENVOXIntelligenceDesignSystem_daebe7 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
/**
 * Badge — small label for severity levels, statuses, and alert types.
 */
function Badge({
  variant = 'neutral',
  size = 'sm',
  shape = 'pill',
  children
}) {
  const variantStyles = {
    critical: {
      background: 'var(--color-critical-border)',
      color: 'var(--color-critical-text)'
    },
    high: {
      background: 'var(--color-high-border)',
      color: 'var(--color-high-text)'
    },
    medium: {
      background: 'var(--color-medium-border)',
      color: 'var(--color-medium-text)'
    },
    low: {
      background: 'var(--color-low-border)',
      color: 'var(--color-low-text)'
    },
    primary: {
      background: 'var(--color-brand-100)',
      color: 'var(--color-brand-800)'
    },
    neutral: {
      background: 'var(--color-neutral-100)',
      color: 'var(--color-text-secondary)'
    },
    success: {
      background: 'var(--color-low-border)',
      color: 'var(--color-low-text)'
    },
    warning: {
      background: 'var(--color-medium-border)',
      color: 'var(--color-medium-text)'
    },
    danger: {
      background: 'var(--color-critical-border)',
      color: 'var(--color-critical-text)'
    }
  };
  const sizeStyles = {
    xs: {
      fontSize: '0.65rem',
      padding: '0.1rem 0.375rem',
      fontWeight: 500
    },
    sm: {
      fontSize: 'var(--text-xs)',
      padding: '0.125rem 0.5rem',
      fontWeight: 500
    },
    md: {
      fontSize: 'var(--text-sm)',
      padding: '0.25rem 0.75rem',
      fontWeight: 500
    }
  };
  const v = variantStyles[variant] || variantStyles.neutral;
  const s = sizeStyles[size] || sizeStyles.sm;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      fontFamily: 'var(--font-sans)',
      borderRadius: shape === 'pill' ? 'var(--radius-full)' : 'var(--radius-md)',
      lineHeight: 1.4,
      ...v,
      ...s
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
/**
 * Button — primary interactive element for actions and form submissions.
 */
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  fullWidth = false,
  type = 'button',
  children,
  onClick
}) {
  const [hovered, setHovered] = React.useState(false);
  const variantStyles = {
    primary: {
      background: hovered ? 'var(--color-primary-hover)' : 'var(--color-primary)',
      color: '#fff'
    },
    secondary: {
      background: hovered ? 'var(--color-primary-light-hover)' : 'var(--color-primary-light)',
      color: 'var(--color-brand-700)'
    },
    ghost: {
      background: hovered ? 'var(--color-neutral-100)' : 'transparent',
      color: 'var(--color-text-secondary)'
    },
    danger: {
      background: hovered ? 'var(--color-critical-dark)' : 'var(--color-critical)',
      color: '#fff'
    },
    success: {
      background: hovered ? 'var(--color-low-dark)' : 'var(--color-low-bg)',
      color: hovered ? '#fff' : 'var(--color-low-text)'
    }
  };
  const sizeStyles = {
    sm: {
      fontSize: 'var(--text-xs)',
      padding: '0.25rem 0.625rem',
      gap: '0.375rem',
      iconSz: '0.65rem'
    },
    md: {
      fontSize: 'var(--text-sm)',
      padding: '0.5rem 1rem',
      gap: '0.5rem',
      iconSz: '0.8rem'
    },
    lg: {
      fontSize: 'var(--text-base)',
      padding: '0.75rem 1.25rem',
      gap: '0.5rem',
      iconSz: '0.9rem'
    }
  };
  const v = variantStyles[variant] || variantStyles.primary;
  const s = sizeStyles[size] || sizeStyles.md;
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => !disabled && setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      flexDirection: iconPosition === 'right' ? 'row-reverse' : 'row',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--font-medium)',
      fontSize: s.fontSize,
      padding: s.padding,
      borderRadius: 'var(--radius-lg)',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background var(--transition-default)',
      width: fullWidth ? '100%' : undefined,
      lineHeight: 1.4,
      textDecoration: 'none',
      ...v
    }
  }, icon && /*#__PURE__*/React.createElement("i", {
    className: `fas fa-${icon}`,
    style: {
      fontSize: s.iconSz
    }
  }), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
/**
 * Card — white rounded container with optional hover lift effect.
 */
function Card({
  padding = 'md',
  hover = false,
  style: extraStyle,
  children
}) {
  const [hovered, setHovered] = React.useState(false);
  const paddings = {
    none: '0',
    sm: 'var(--space-4)',
    md: 'var(--space-6)',
    lg: 'var(--space-8)'
  };
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => hover && setHovered(true),
    onMouseLeave: () => hover && setHovered(false),
    style: {
      background: 'var(--color-bg-card)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border-card)',
      boxShadow: hovered && hover ? 'var(--shadow-card-hover)' : 'var(--shadow-sm)',
      padding: paddings[padding] ?? paddings.md,
      transition: hover ? 'transform var(--transition-default), box-shadow var(--transition-default)' : undefined,
      transform: hovered && hover ? 'translateY(-2px)' : undefined,
      ...extraStyle
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/AlertItem.jsx
try { (() => {
/**
 * AlertItem — single alert row with severity-coded left border,
 * type badge, excerpt preview, and acknowledge/resolve actions.
 */
function AlertItem({
  title,
  description,
  excerpt,
  severity = 'medium',
  alertType,
  conversationName,
  timestamp,
  onAcknowledge,
  onResolve
}) {
  const severityConfig = {
    critical: {
      borderColor: 'var(--color-critical)',
      iconClass: 'fa-exclamation-circle',
      iconColor: 'var(--color-critical)',
      badge: {
        bg: 'var(--color-critical-border)',
        color: 'var(--color-critical-text)'
      },
      label: 'Crítico'
    },
    high: {
      borderColor: 'var(--color-high)',
      iconClass: 'fa-exclamation-triangle',
      iconColor: 'var(--color-high)',
      badge: {
        bg: 'var(--color-high-border)',
        color: 'var(--color-high-text)'
      },
      label: 'Alto'
    },
    medium: {
      borderColor: 'var(--color-medium)',
      iconClass: 'fa-exclamation',
      iconColor: 'var(--color-medium-dark)',
      badge: {
        bg: 'var(--color-medium-border)',
        color: 'var(--color-medium-text)'
      },
      label: 'Médio'
    },
    low: {
      borderColor: 'var(--color-low)',
      iconClass: 'fa-info-circle',
      iconColor: 'var(--color-low)',
      badge: {
        bg: 'var(--color-low-border)',
        color: 'var(--color-low-text)'
      },
      label: 'Baixo'
    }
  };
  const c = severityConfig[severity] || severityConfig.medium;
  const actionBtnStyle = (bg, color) => ({
    padding: '4px 8px',
    fontSize: 'var(--text-xs)',
    background: bg,
    color: color,
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-bg-card)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-4)',
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--color-border-card)',
      borderLeft: `4px solid ${c.borderColor}`,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: `fas ${c.iconClass}`,
    style: {
      color: c.iconColor,
      marginTop: '2px',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      flexWrap: 'wrap',
      marginBottom: 'var(--space-1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 'var(--font-semibold)',
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-primary)'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '0.125rem 0.5rem',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)',
      fontWeight: 500,
      background: c.badge.bg,
      color: c.badge.color
    }
  }, c.label), alertType && /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '0.125rem 0.5rem',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)',
      background: 'var(--color-neutral-100)',
      color: 'var(--color-text-secondary)'
    }
  }, alertType)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-secondary)',
      margin: '0 0 var(--space-1) 0'
    }
  }, description), excerpt && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-neutral-50)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-2)',
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-muted)',
      fontStyle: 'italic'
    }
  }, "\"", excerpt.length > 150 ? excerpt.substring(0, 150) + '…' : excerpt, "\""), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      marginTop: 'var(--space-2)',
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-placeholder)'
    }
  }, conversationName && /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-users",
    style: {
      marginRight: '4px'
    }
  }), conversationName), timestamp && /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-clock",
    style: {
      marginRight: '4px'
    }
  }), timestamp)))), (onAcknowledge || onResolve) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-2)',
      flexShrink: 0
    }
  }, onAcknowledge && /*#__PURE__*/React.createElement("button", {
    onClick: onAcknowledge,
    style: actionBtnStyle('var(--color-brand-50)', 'var(--color-brand-700)')
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-eye"
  })), onResolve && /*#__PURE__*/React.createElement("button", {
    onClick: onResolve,
    style: actionBtnStyle('var(--color-low-bg)', 'var(--color-low-text)')
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-check"
  })))));
}
Object.assign(__ds_scope, { AlertItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/AlertItem.jsx", error: String((e && e.message) || e) }); }

// components/data/GroupCard.jsx
try { (() => {
/**
 * GroupCard — WhatsApp group monitoring card showing temperature score,
 * sentiment, risk/opportunity scores, and pending items.
 */
function GroupCard({
  name,
  messageCount,
  temperatureScore,
  sentimentLabel,
  riskScore,
  opportunityScore,
  followupsPending,
  openAlerts
}) {
  const [hovered, setHovered] = React.useState(false);
  const getTempStyle = score => {
    if (score >= 80) return {
      color: 'var(--color-low-text)',
      background: 'var(--color-low-bg)'
    };
    if (score >= 60) return {
      color: 'var(--color-brand-600)',
      background: 'var(--color-brand-50)'
    };
    if (score >= 40) return {
      color: 'var(--color-medium-dark)',
      background: 'var(--color-medium-bg)'
    };
    if (score >= 20) return {
      color: 'var(--color-high-dark)',
      background: 'var(--color-high-bg)'
    };
    return {
      color: 'var(--color-critical-dark)',
      background: 'var(--color-critical-bg)'
    };
  };
  const sentConfig = {
    positive: {
      iconClass: 'fa-smile',
      color: 'var(--color-low)',
      label: 'Positivo'
    },
    negative: {
      iconClass: 'fa-frown',
      color: 'var(--color-high)',
      label: 'Negativo'
    },
    critical: {
      iconClass: 'fa-angry',
      color: 'var(--color-critical)',
      label: 'Crítico'
    },
    neutral: {
      iconClass: 'fa-meh',
      color: 'var(--color-neutral-400)',
      label: 'Neutro'
    }
  };
  const sc = sentConfig[sentimentLabel] || sentConfig.neutral;
  const tempStyle = getTempStyle(temperatureScore ?? 0);
  const metaItem = (iconClass, color, text) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      color
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: `fas ${iconClass}`,
    style: {
      width: '12px'
    }
  }), /*#__PURE__*/React.createElement("span", null, text));
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      background: 'var(--color-bg-card)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-5)',
      boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-sm)',
      border: '1px solid var(--color-border-card)',
      transform: hovered ? 'translateY(-2px)' : 'none',
      transition: 'transform var(--transition-default), box-shadow var(--transition-default)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontWeight: 'var(--font-semibold)',
      color: 'var(--color-text-primary)',
      fontSize: 'var(--text-sm)',
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-placeholder)',
      marginTop: '2px'
    }
  }, messageCount, " msg hoje")), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '4px 8px',
      borderRadius: 'var(--radius-lg)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-bold)',
      flexShrink: 0,
      marginLeft: 'var(--space-2)',
      ...tempStyle
    }
  }, temperatureScore)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-2)',
      fontSize: 'var(--text-xs)'
    }
  }, metaItem(sc.iconClass, sc.color, `Clima: ${sc.label}`), metaItem('fa-shield-alt', (riskScore ?? 0) >= 60 ? 'var(--color-critical-dark)' : 'var(--color-text-secondary)', `Risco: ${Math.round(riskScore ?? 0)}/100`), opportunityScore > 0 && metaItem('fa-lightbulb', 'var(--color-low-dark)', `Oport: ${Math.round(opportunityScore)}/100`), followupsPending > 0 && metaItem('fa-clock', 'var(--color-medium-dark)', `${followupsPending} follow-up(s)`), openAlerts > 0 && metaItem('fa-bell', 'var(--color-critical-dark)', `${openAlerts} alerta(s)`)));
}
Object.assign(__ds_scope, { GroupCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/GroupCard.jsx", error: String((e && e.message) || e) }); }

// components/data/KPICard.jsx
try { (() => {
/**
 * KPICard — metric card displaying a single operational KPI with
 * optional trend indicator and color-coded theme.
 */
function KPICard({
  label,
  value,
  trend,
  trendUp,
  colorTheme = 'default'
}) {
  const [hovered, setHovered] = React.useState(false);
  const themes = {
    default: {
      bg: '#ffffff',
      border: 'var(--color-border-card)',
      labelColor: 'var(--color-text-muted)',
      valueColor: 'var(--color-text-primary)'
    },
    alert: {
      bg: 'var(--color-critical-bg)',
      border: 'var(--color-critical-border)',
      labelColor: 'var(--color-critical-dark)',
      valueColor: 'var(--color-critical-text)'
    },
    success: {
      bg: 'var(--color-low-bg)',
      border: 'var(--color-low-border)',
      labelColor: 'var(--color-low-dark)',
      valueColor: 'var(--color-low-text)'
    },
    warning: {
      bg: 'var(--color-medium-bg)',
      border: 'var(--color-medium-border)',
      labelColor: 'var(--color-medium-dark)',
      valueColor: 'var(--color-medium-text)'
    },
    orange: {
      bg: 'var(--color-high-bg)',
      border: 'var(--color-high-border)',
      labelColor: 'var(--color-high-dark)',
      valueColor: 'var(--color-high-text)'
    }
  };
  const t = themes[colorTheme] || themes.default;
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-4)',
      boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-sm)',
      transform: hovered ? 'translateY(-2px)' : 'none',
      transition: 'transform var(--transition-default), box-shadow var(--transition-default)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-card-label)',
      color: t.labelColor,
      marginBottom: 'var(--space-1)',
      fontWeight: 'var(--font-medium)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-kpi)',
      fontWeight: 'var(--font-bold)',
      color: t.valueColor,
      lineHeight: 1.2
    }
  }, value ?? '—'), trend != null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      marginTop: 'var(--space-1)',
      color: trendUp ? 'var(--color-low-dark)' : trendUp === false ? 'var(--color-critical)' : 'var(--color-text-muted)'
    }
  }, trendUp === true && '▲ ', trendUp === false && '▼ ', trend));
}
Object.assign(__ds_scope, { KPICard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/KPICard.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.AlertItem = __ds_scope.AlertItem;

__ds_ns.GroupCard = __ds_scope.GroupCard;

__ds_ns.KPICard = __ds_scope.KPICard;

})();
