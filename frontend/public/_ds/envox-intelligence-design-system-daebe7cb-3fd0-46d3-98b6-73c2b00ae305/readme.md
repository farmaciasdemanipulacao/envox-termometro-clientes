# ENVOX Intelligence — Design System

> Design system oficial para o produto **ENVOX Intelligence** — plataforma de inteligência operacional para monitoramento de conversas de atendimento.

---

## Sobre o Produto

**ENVOX Intelligence** é uma plataforma interna que lê, consolida e analisa conversas de atendimento oriundas principalmente do WhatsApp e entrega à liderança da empresa:

- **Dashboard executivo** com visão geral da operação em tempo real
- **Termômetro operacional** com score 0–100 e label (Excelente → Crítico)
- **Alertas preventivos** categorizados por severidade (Crítico / Alto / Médio / Baixo)
- **Resumo executivo diário** consolidado gerado via heurísticas (ou LLM opcional)
- **Monitoramento por grupo** de WhatsApp com risco, oportunidade e follow-ups
- **Performance de colaboradores** (prevista para versões futuras)

O principal usuário é o **dono da ENVOX** — alguém que precisa de visibilidade executiva sem necessidade de ler cada mensagem manualmente.

---

## Fontes

| Fonte | URL | Notas |
|---|---|---|
| Repositório principal | https://github.com/farmaciasdemanipulacao/envox-termometro-clientes | Frontend em `frontend/public/index.html` |
| Arquivo de contexto | `PROJECT_CONTEXT.md` no repo | Visão de produto e escopo do MVP |
| Arquitetura | `ARCHITECTURE.md` no repo | Fluxos, componentes, endpoints |
| Roadmap | `ROADMAP.md` no repo | Próximas fases e backlog |

> Explore o repositório GitHub para entender o produto mais profundamente. O frontend atual é um único arquivo HTML com Tailwind CDN + Vanilla JS — esta design system extrai e formaliza os padrões visuais encontrados nele.

---

## CONTENT FUNDAMENTALS

### Idioma
Toda a interface usa **Português Brasileiro (pt-BR)** — tanto copy da UI quanto dados e labels.

### Tom e Voz
- **Direto e operacional.** A audiência é gestão executiva, não público geral.
- **Foco em ação.** Copy aponta o problema e o que fazer, sem rodeios.
- **Sem tom de marketing.** Nenhum "Bem-vindo à revolução do atendimento!" — apenas informação limpa.
- **Primeira pessoa ausente.** Os textos falam da operação, não do produto em si.

### Casing
- **Nav items:** Título Case — "Visão Geral", "Resumo Executivo", "Alertas"
- **Section headings:** Título Case — "Visão Geral do Dia", "Alertas em Aberto"
- **KPI labels:** Sentence case curto — "Mensagens Hoje", "Grupos Ativos"
- **Botões:** Sentence case — "Atualizar", "Gerar Resumo"
- **Badges de tipo:** Emoji + Noun — "⚠️ Risco Churn", "💡 Oportunidade", "⏰ Follow-up"

### Emoji
Usados **somente** em labels de status/tipo — nunca como decoração:
- 🟢🔵🟡🟠🔴 — status do Termômetro (Excelente → Crítico)
- ✅ — confirmação de ausência de alertas
- ⚠️💡⏰😤😠🔥🤝 — tipos de alerta (prefixo em badges)
- 📈📉➡️ — indicadores de tendência

### Números e Datas
- Números: formato brasileiro — vírgula como decimal, ponto como milhar
- Datas: `dia de mês de ano` — ex: "22 de junho de 2026"
- Score: sempre `N / 100` ou `N%` sem casas decimais desnecessárias

### Exemplos de Copy
```
"Nenhum alerta aberto. Operação tranquila! ✅"
"Atualizado em 22/06/2026, 14:35:20"
"1 cliente VIP sinalizou cancelamento"
"Gerar Resumo"          ← botão principal
"Marcar como visto"     ← ação secundária
"Dados de performance do time serão exibidos aqui conforme as métricas forem acumuladas."
```

---

## VISUAL FOUNDATIONS

### Paleta de Cores

**Primária — Azul** (`--color-brand-*`): O único acento de marca. Usado em CTAs, nav ativo, logo, ícones de seção. Tom dominante: `blue-600` (#2563EB).

**Neutro — Cinza** (`--color-neutral-*`): Base de toda a interface. `neutral-50` para fundo de página, `neutral-900` para sidebar, `neutral-800` para headings.

**Escala de Severidade**: O sistema visual mais importante do produto.
| Severidade | Cor | Uso |
|---|---|---|
| Crítico | `#ef4444` (red-500) | Borda esquerda de alerta, KPI card bg tinto, badge |
| Alto | `#f97316` (orange-500) | Mesmos padrões |
| Médio | `#eab308` (yellow-500) | Mesmos padrões |
| Baixo | `#22c55e` (green-500) | Mesmos padrões |

Cada severidade tem **três variantes**: cor principal, bg suave, texto escuro — ver `tokens/colors.css`.

**Score de temperatura**: Mapeamento automático 0–100 → cor:
`81–100` verde · `61–80` azul · `41–60` amarelo · `21–40` laranja · `0–20` vermelho

### Tipografia
- **Família**: Inter (substituto de Google Fonts). O original usa o stack de sistema do Tailwind (`ui-sans-serif, system-ui`). Forneça arquivos TTF da fonte original para substituir.
- **Escala**: 7 tamanhos de `--text-xs` (12px) a `--text-3xl` (30px)
- **Pesos dominantes**: `700` para KPIs e headings, `600` para títulos de alerta, `500` para botões e nav, `400` para corpo
- **Tamanho dominante na UI**: `--text-sm` (14px) — cobre 80% do texto

### Fundos e Superfícies
- **Página**: `neutral-50` (#f9fafb) — cinza muito suave, nunca branco puro
- **Cards**: branco (#fff) com borda `neutral-100` e `shadow-sm` — efeito "flutuando sobre cinza"
- **Sidebar**: `neutral-900` (#111827) — escuro e imponente, sem gradiente
- **Sem imagens de fundo**, sem texturas, sem padrões decorativos

> **Nota (2026-07-07):** desde a introdução do modo claro/escuro (ver seção "Tema Claro/Escuro" abaixo), os valores acima (`neutral-*`) são a paleta **crua/base**, não os valores efetivos em produção. Os aliases `--color-bg-*`, `--color-text-*` e `--color-border-*` que os componentes de fato consomem vivem em `tokens/theme.css` e mudam de valor conforme `data-theme="light"` ou `"dark"` no `<html>` — ver a nota de rebrand ATENX/paleta abaixo antes de usar os hex desta seção como referência literal.

### Tema Claro/Escuro (adicionado 2026-07-07)
O app ATENX (nome de produto atual — ver nota de rebrand abaixo; o namespace JS interno `ENVOXIntelligenceDesignSystem_daebe7` não foi renomeado) suporta os dois temas, escolhidos pelo usuário (ícone sol/lua no Sidebar) ou pela preferência do sistema operacional na primeira visita, persistido em `localStorage['atenx-theme']`.

- `tokens/colors.css` guarda só o que **não muda** entre temas: paleta de marca (teal `--color-brand-*`), escala de severidade, paleta bruta `--color-neutral-*` (usada como matéria-prima, não diretamente pelos componentes).
- `tokens/theme.css` (novo) guarda os aliases que **mudam** por tema: `--color-bg-page/card/sidebar/header/hover-sidebar/input/popover`, `--color-text-primary/secondary/muted/placeholder/on-sidebar(-muted)`, `--color-border-card/default/input/sidebar`, `--color-scrollbar-*` — definidos em dois blocos `:root[data-theme="light"]` e `:root[data-theme="dark"]`, com fallback via `@media (prefers-color-scheme: dark)` para quando o JS ainda não rodou.
- Componentes devem sempre consumir os aliases de `theme.css` (ex: `var(--color-bg-card)`), nunca a paleta crua de `colors.css` (ex: `var(--color-neutral-50)`) — só assim herdam o tema automaticamente.
- Cores categóricas (severidade, status de assinatura, tags, "bolhas" de mensagem estilo WhatsApp) são **intencionalmente fixas** nos dois temas — não fazem parte do sistema de tema.

### Cards
- `border-radius: var(--radius-xl)` — 12px, arredondado mas não exagerado
- `border: 1px solid var(--color-border-card)` — linha sutilíssima
- `box-shadow: var(--shadow-sm)` — sombra quase imperceptível no repouso
- **Hover lift**: `translateY(-2px)` + `shadow-card-hover`, 0.2s ease — aplicado nos KPICards e GroupCards
- **Alert cards**: mesma estrutura + `border-left: 4px solid <severity-color>` sobreposto ao border padrão

### Animações
- **Entrada de seção**: `fadeInUp` — opacidade 0→1 + translateY(8px→0), 0.4s ease
- **Loading spinner**: `spin` — border-top azul girando, 0.8s linear
- **Card hover**: `translateY(-2px)` + shadow mais profunda, 0.2s ease
- **Refresh icon**: rotação contínua enquanto carrega
- **Sem animações infinitas de decoração**
- **Preferência reduzida de movimento**: não implementada no MVP — considerar no futuro

### Hover e Press States
- **Botões**: mudança de background (tom mais escuro), sem shrink
- **Nav items**: `bg-gray-700 text-white` ao hover
- **Nav ativo**: `bg-blue-600 text-white` fixo
- **Cards**: lift sutil (translateY -2px)
- **Action buttons nos alertas**: bg suave tintado (azul/verde para ack/resolve)

### Borders e Separadores
- Cards: `1px solid var(--color-border-card)` — `neutral-100`
- Header: `1px solid var(--color-border-default)` — `neutral-200`
- Sidebar dividers: `1px solid var(--color-neutral-700)`
- Sem uso de `border-right` ou ornamentais em sidebar

### Scrollbar
- Largura: 6px
- Track: `#f1f5f9` (azul-cinza claro)
- Thumb: `#94a3b8` (cinza-azulado médio), radius 3px

### Transparência e Blur
- Não utilizados em nenhuma parte do MVP atual

### Imagens e Ilustrações
- **Nenhuma imagem** usada na interface atual
- Sem ilustrações, sem avatares com foto, sem backgrounds image
- Avatares são ícones FA em círculo colorido (`bg-blue-600`)

---

## ICONOGRAPHY

### Biblioteca
**Font Awesome Free 6.4.0** via CDN:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
```
Todos os ícones usam o estilo **solid** (`fas fa-*`). Não há uso de `far` (regular) ou `fab` (brands).

### Ícones-Chave por Contexto

| Contexto | Classe FA | Uso |
|---|---|---|
| Logo / Produto | `fa-brain` | Ícone principal da marca no sidebar e login |
| Navegação | `fa-tachometer-alt` | Visão Geral |
| Navegação | `fa-file-alt` | Resumo Executivo |
| Navegação | `fa-bell` | Alertas (com badge numérico) |
| Navegação | `fa-users` | Grupos |
| Navegação | `fa-user-tie` | Time |
| Navegação | `fa-code` | API Docs |
| Widget | `fa-thermometer-half` | Termômetro |
| Severidade Crítica | `fa-exclamation-circle` | Ícone de alerta crítico |
| Severidade Alta | `fa-exclamation-triangle` | Ícone de alerta alto e distribuição |
| Severidade Média | `fa-exclamation` | Ícone de alerta médio |
| Severidade Baixa | `fa-info-circle` | Ícone de alerta baixo |
| Sentimento | `fa-smile`, `fa-frown`, `fa-angry`, `fa-meh` | Clima do grupo |
| Métricas | `fa-shield-alt` | Score de risco |
| Métricas | `fa-lightbulb` | Score de oportunidade |
| Métricas | `fa-clock` | Follow-ups pendentes |
| Ações | `fa-sync-alt` | Atualizar / Refresh |
| Ações | `fa-magic` | Gerar Resumo |
| Ações | `fa-eye` | Marcar alerta como visto |
| Ações | `fa-check`, `fa-check-circle` | Resolver alerta / sucesso |
| Ações | `fa-sign-in-alt`, `fa-sign-out-alt` | Autenticação |
| Ações | `fa-chart-line` | Tendências |
| Usuário | `fa-user` | Avatar do usuário logado |

### Tamanhos
- **Sidebar nav items**: 14px (`font-size: 14px` ou `var(--text-sm)`)
- **Dentro de botões**: `0.8rem` (md), `0.65rem` (sm), `0.9rem` (lg)
- **Section headings**: herda tamanho do heading (`18px`)
- **KPI / widget**: `1.5rem` a `2rem`
- **Alert icons**: 14–16px, cor correspondente à severidade

### Ícones como SVG ou PNG
Não utilizados. Todos os ícones são webfont (Font Awesome).

### Emoji como Ícones
**Não.** Emoji aparecem apenas em **labels de texto** (badges, status). Nunca como ícone standalone em botão ou nav.

---

## File Index

```
/
├── styles.css                          ← Entry point; importe apenas este arquivo
├── readme.md                           ← Este documento
├── SKILL.md                            ← Skill para Claude Code
│
├── tokens/
│   ├── colors.css                      ← Paleta brand, neutral, severity (tudo invariável por tema)
│   ├── theme.css                       ← Aliases claro/escuro (bg/text/border) — ver "Tema Claro/Escuro" acima
│   ├── typography.css                  ← Famílias, escala de tamanhos, pesos, roles semânticos
│   └── spacing.css                     ← Escala de espaçamento, radii, sombras, transições
│
├── components/
│   ├── core/
│   │   ├── Button.jsx + .d.ts          ← Botões de ação (5 variants, 3 sizes)
│   │   ├── Badge.jsx  + .d.ts          ← Badges de severidade e status
│   │   ├── Card.jsx   + .d.ts          ← Container branco com hover lift
│   │   └── core.card.html             ← Specimen card — grupo "Components"
│   └── data/
│       ├── KPICard.jsx   + .d.ts       ← Card de métrica com tema colorido
│       ├── AlertItem.jsx + .d.ts       ← Linha de alerta com borda de severidade
│       ├── GroupCard.jsx + .d.ts       ← Card de monitoramento de grupo WhatsApp
│       └── data.card.html             ← Specimen card — grupo "Components"
│
├── guidelines/
│   ├── colors-brand.card.html         ← Paleta azul (50–800)
│   ├── colors-neutral.card.html       ← Paleta cinza (50–900)
│   ├── colors-severity.card.html      ← Escala de severidade (4 cores)
│   ├── type-scale.card.html           ← Escala tipográfica (7 tamanhos)
│   ├── type-weights.card.html         ← Pesos de fonte (400–700)
│   ├── spacing-scale.card.html        ← Escala de espaçamento (9 tokens)
│   ├── radii-shadows.card.html        ← Raios de borda + sombras
│   └── brand-logo.card.html           ← Logo ENVOX (dark + light)
│
├── ui_kits/
│   └── dashboard/
│       └── index.html                 ← Painel executivo completo e interativo
│
└── assets/
    └── iconography.md                 ← Notas de iconografia (Font Awesome)
```

### Componentes Disponíveis

| Componente | Namespace | Props principais |
|---|---|---|
| `Button` | `ENVOXIntelligenceDesignSystem_daebe7.Button` | `variant`, `size`, `icon`, `disabled`, `fullWidth` |
| `Badge` | `ENVOXIntelligenceDesignSystem_daebe7.Badge` | `variant`, `size`, `shape` |
| `Card` | `ENVOXIntelligenceDesignSystem_daebe7.Card` | `padding`, `hover`, `style` |
| `KPICard` | `ENVOXIntelligenceDesignSystem_daebe7.KPICard` | `label`, `value`, `trend`, `trendUp`, `colorTheme` |
| `AlertItem` | `ENVOXIntelligenceDesignSystem_daebe7.AlertItem` | `severity`, `title`, `description`, `excerpt`, `alertType`, `onResolve` |
| `GroupCard` | `ENVOXIntelligenceDesignSystem_daebe7.GroupCard` | `name`, `temperatureScore`, `sentimentLabel`, `riskScore`, ... |

### Uso em Projetos Consumidores

```html
<link rel="stylesheet" href="_ds/envox/styles.css">
<script src="_ds/envox/_ds_bundle.js"></script>

<script type="text/babel">
const { Button, KPICard, AlertItem } = window.ENVOXIntelligenceDesignSystem_daebe7;
// ... use components
</script>
```

---

*ENVOX Intelligence Design System — v0.1.0 | Junho 2026*
