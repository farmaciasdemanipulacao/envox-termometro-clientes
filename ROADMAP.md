# ENVOX Intelligence — ROADMAP

> Última atualização: 2026-06-16

---

## Fase 1 — MVP Core (semanas 1–3) ← VOCÊ ESTÁ AQUI

**Objetivo:** Sistema funcional ponta a ponta com dados simulados.

### Entregáveis
- [x] Arquivos de contexto e documentação
- [x] Scaffold do projeto (estrutura de diretórios)
- [ ] Modelo de dados completo (migrations Alembic)
- [ ] API FastAPI com endpoints principais
- [ ] Motor de heurísticas v1
- [ ] Ingestão via webhook e CSV
- [ ] Resumo diário (job + endpoint)
- [ ] Sistema de alertas (scanner + CRUD)
- [ ] Dashboard web (visão geral, alertas, grupos, time)
- [ ] Seeds de dados realistas (~500 mensagens simuladas)
- [ ] Docker-compose funcional
- [ ] Autenticação básica (API Key + JWT simples)
- [ ] README técnico completo

### KPIs de aceitação
- Ingerir 100 mensagens via API sem erro
- Resumo diário gerado com texto coerente
- Dashboard carrega em < 2s
- Alertas de risco detectados corretamente em mensagens-teste

---

## Fase 2 — Enriquecimento e Conectividade (semanas 4–6)

**Objetivo:** Conectar origem real de dados e enriquecer análise.

### Entregáveis
- [ ] Connector WhatsApp Business API (se WABA aprovada)
- [ ] Connector para plataforma omnichannel (ex: Chatwoot, Zendesk)
- [ ] Análise de sentimento aprimorada (modelo leve ou LLM)
- [ ] Resumo executivo com OpenAI (1 chamada/dia, custo controlado)
- [ ] Notificação via e-mail (resumo diário)
- [ ] Notificação via Telegram Bot (alertas críticos)
- [ ] Exportação de relatório (CSV/PDF simples)
- [ ] Métricas de SLA configuráveis por grupo
- [ ] Busca em mensagens (full-text PostgreSQL)

---

## Fase 3 — Inteligência Avançada (semanas 7–10)

**Objetivo:** Inteligência mais sofisticada e escalabilidade.

### Entregáveis
- [ ] Scoring de churn preditivo (modelo simples ML ou regras avançadas)
- [ ] Clusterização de temas recorrentes (TF-IDF ou embeddings)
- [ ] Timeline de conversa com análise de arco emocional
- [ ] Comparativo semana/mês para cada KPI
- [ ] Multi-usuário com roles (admin, gestor, visualizador)
- [ ] Configuração de thresholds de alerta por grupo/cliente
- [ ] API pública documentada para integrações externas
- [ ] Performance: índices PostgreSQL + cache de queries frequentes

---

## Fase 4 — Produção e Escala (semanas 11–16)

**Objetivo:** Produto robusto, escalável e autossustentável.

### Entregáveis
- [ ] Migração APScheduler → Celery + Redis (se necessário)
- [ ] Autenticação OAuth2/OIDC (SSO)
- [ ] Anonimização/pseudonimização de dados (LGPD completa)
- [ ] Backup automatizado do banco (S3/MinIO)
- [ ] Monitoring: Prometheus + Grafana (métricas da app)
- [ ] Multi-tenant (suporte a múltiplas empresas)
- [ ] App mobile (PWA ou React Native)
- [ ] Marketplace de conectores

---

## Backlog Priorizado (MVP+)

| Prioridade | Item | Impacto | Esforço |
|-----------|------|---------|---------|
| 🔴 Alta | WhatsApp Business API connector | Alto | Alto |
| 🔴 Alta | Notificação e-mail (alerta crítico) | Alto | Baixo |
| 🟡 Média | Resumo com LLM (OpenAI) | Alto | Médio |
| 🟡 Média | Busca full-text em mensagens | Médio | Baixo |
| 🟡 Média | Exportação CSV | Médio | Baixo |
| 🟢 Baixa | Relatório PDF | Médio | Médio |
| 🟢 Baixa | Multi-usuário com roles | Alto | Alto |
| 🟢 Baixa | Dashboard mobile-friendly | Médio | Médio |

---

## Próximos Passos Imediatos

1. ✅ Arquivos de contexto criados
2. 🔄 Scaffold + modelos de dados + API base
3. ⏳ Motor de heurísticas
4. ⏳ Jobs agendados (resumo + alertas)
5. ⏳ Dashboard HTML
6. ⏳ Seeds + validação
7. ⏳ Docker-compose final
