# ENVOX Intelligence — DECISIONS LOG

> Registro de decisões técnicas, trade-offs e escolhas arquiteturais.
> Última atualização: 2026-06-16

---

## DEC-001 — Não integrar WhatsApp diretamente no MVP

**Decisão:** A camada de origem de dados é completamente desacoplada. O MVP usa ingestão genérica via API/webhook e importação CSV/JSON.

**Motivo:**
- Integração com WhatsApp via baileys/multi-device é frágil e viola ToS do WhatsApp
- WhatsApp Business API requer aprovação Meta, número dedicado e custo mensal
- O valor central do produto é a inteligência, não o canal de entrada
- Desacoplar permite plugar qualquer origem depois sem mudar a plataforma

**Alternativa descartada:** Scraping WhatsApp Web — risco de ban, instabilidade, violação de ToS.

**Próximo passo:** Criar WhatsAppBusinessConnector (stub) com contrato completo. Implementar quando WABA for aprovada.

---

## DEC-002 — FastAPI como backend principal

**Decisão:** Python 3.11 + FastAPI como framework backend.

**Motivo:**
- Async nativo, alto throughput para I/O
- Documentação OpenAPI automática (Swagger UI em /docs)
- Ecossistema rico para IA/análise de texto (NLTK, spaCy, OpenAI SDK)
- SQLAlchemy 2.x async integra bem
- Time de manutenção Python é mais amplo que Go/Rust para esse tipo de produto

**Alternativa descartada:** Node.js/Express — ecossistema de NLP/IA menos maduro.

---

## DEC-003 — PostgreSQL como banco principal

**Decisão:** PostgreSQL 15 como único banco de dados.

**Motivo:**
- JSONB para campos flexíveis (metadados de mensagem, payload bruto)
- Full-text search nativo (futuro: busca em mensagens)
- Confiável, maduro, sem custo de licença
- Uma única instância é suficiente para o volume inicial

**Alternativa descartada:** MongoDB — ACID menos robusto, maior complexidade para analytics.
**Alternativa descartada:** MySQL — JSONB menos poderoso.

---

## DEC-004 — APScheduler em vez de Celery/Redis

**Decisão:** APScheduler in-process para jobs agendados no MVP.

**Motivo:**
- Celery requer Redis/RabbitMQ como broker — infraestrutura adicional desnecessária no MVP
- APScheduler roda dentro do processo FastAPI — zero custo de infra
- Volume inicial (~10-15 grupos) não justifica filas distribuídas
- Jobs são: resumo diário, scan de alertas, update de métricas — baixa frequência

**Trade-off:** APScheduler não escala horizontalmente. Quando houver múltiplas instâncias da API, migrar para Celery + Redis.

**Trigger de migração:** quando precisar de múltiplas instâncias da API OU jobs > 1/minuto com carga alta.

---

## DEC-005 — Frontend leve HTML/CSS/JS vanilla

**Decisão:** Dashboard como páginas HTML com TailwindCSS CDN e JavaScript vanilla.

**Motivo:**
- Zero build toolchain — arquivo HTML abre direto no browser
- Zero dependência de npm/node no container de frontend
- Dashboard executivo não precisa de reatividade complexa
- Manutenção muito mais simples para evoluir
- Facilita embed futuro em outras ferramentas

**Alternativa descartada:** Next.js/React — overkill para MVP, aumenta complexidade de deploy e manutenção.

**Próximo passo:** se o dashboard crescer muito em interatividade, migrar para Alpine.js ou HTMX antes de ir para React.

---

## DEC-006 — Alembic para migrations

**Decisão:** Alembic como ferramenta de migrations, não auto-criação de tabelas.

**Motivo:**
- `create_all()` do SQLAlchemy é perigoso em produção (não faz rollback, não é versionado)
- Alembic gera histórico auditável de mudanças no schema
- Essencial para evoluir o schema sem perder dados

**Decisão complementar:** No startup do app, executar `alembic upgrade head` automaticamente (configurável via env var `AUTO_MIGRATE=true`).

---

## DEC-007 — Heurísticas antes de LLM

**Decisão:** Motor de análise baseado em regras/heurísticas para o MVP, com interface preparada para LLM.

**Motivo:**
- LLM por mensagem = custo proibitivo para volume alto (ex: 2000 mensagens/dia × $0.01 = $20/dia = $600/mês só de análise)
- Heurísticas bem calibradas cobrem 70-80% dos casos de uso
- IA fica reservada para: resumo executivo final (1 chamada/dia) e análise de mensagens de alta severidade
- Interface `AnalyzerBase` permite trocar implementação sem mudar código cliente

**Arquitetura:** Heurísticas triagem → Score calculado → Se score alto E IA habilitada → LLM enriquece

---

## DEC-008 — Autenticação por camada

**Decisão:** Dois mecanismos de auth:
- **API Key** (header `X-API-Key`): para conectores/ingestão externa — simples, stateless
- **JWT** (header `Authorization: Bearer`): para usuários do dashboard

**Motivo:**
- Fontes externas (webhooks, scripts) preferem API Keys simples
- Usuários humanos precisam de sessão com expiração (JWT)
- Ambos são simples de implementar e evoluir

**Próximo passo:** Adicionar OAuth2/OIDC quando houver múltiplos usuários com roles.

---

## DEC-009 — Estrutura modular por domínio

**Decisão:** Organizar código por domínio de negócio (ingest, analysis, summaries, alerts, metrics) e não por tipo técnico.

**Motivo:**
- Facilita entendimento: "onde está a lógica de alertas?" → `services/analysis/` + `api/routes/alerts.py`
- Facilita evolução independente de cada módulo
- Reduz acoplamento entre domínios

---

## DEC-010 — Retenção de dados configurável

**Decisão:** `DATA_RETENTION_DAYS=90` como variável de ambiente. Job de limpeza semanal.

**Motivo:** LGPD exige transparência sobre tempo de retenção. 90 dias cobre análise de tendências mensais sem acumular dados indefinidamente.

**Trade-off:** Dados históricos além de 90 dias são perdidos. Solução futura: arquivamento em S3/MinIO antes de deletar.
