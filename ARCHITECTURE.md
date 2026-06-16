# ENVOX Intelligence — ARCHITECTURE

> Última atualização: 2026-06-16 | Versão: 0.1.0

---

## 1. Visão Macro

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ENVOX INTELLIGENCE                           │
├──────────────────────────┬──────────────────────────────────────────┤
│      CAMADA A            │           CAMADA B                       │
│   ORIGEM DOS DADOS       │     INTELIGÊNCIA OPERACIONAL             │
│                          │                                          │
│  ┌──────────────────┐    │  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │  WhatsApp WABA   │───▶│  │ Ingest  │  │ Analyze  │  │ Store  │ │
│  │  (futuro)        │    │  │ Service │─▶│ Engine   │─▶│  PG    │ │
│  ├──────────────────┤    │  └─────────┘  └──────────┘  └────────┘ │
│  │  Webhook/API     │───▶│       │            │                     │
│  ├──────────────────┤    │       ▼            ▼                     │
│  │  CSV/JSON Import │───▶│  ┌─────────┐  ┌──────────┐             │
│  ├──────────────────┤    │  │  Jobs   │  │ Summary  │             │
│  │  Omnichannel     │───▶│  │(APSched)│  │ & Alerts │             │
│  │  (futuro)        │    │  └─────────┘  └──────────┘             │
│  └──────────────────┘    │                    │                     │
│                          │                    ▼                     │
│                          │  ┌──────────────────────────────────┐   │
│                          │  │         FastAPI REST API          │   │
│                          │  └──────────────┬───────────────────┘   │
│                          │                 │                        │
│                          │                 ▼                        │
│                          │  ┌──────────────────────────────────┐   │
│                          │  │      Dashboard Web (HTML/JS)      │   │
│                          │  └──────────────────────────────────┘   │
└──────────────────────────┴──────────────────────────────────────────┘
```

---

## 2. Componentes

### 2.1 Backend (FastAPI)

```
backend/app/
├── api/routes/          # Endpoints REST organizados por domínio
│   ├── ingest.py        # POST /ingest/messages, /ingest/batch
│   ├── messages.py      # GET listagem e detalhe de mensagens
│   ├── conversations.py # GET conversas/grupos
│   ├── summaries.py     # GET/POST resumos diários
│   ├── alerts.py        # GET/PATCH alertas
│   ├── dashboard.py     # GET overview executivo
│   ├── metrics.py       # GET métricas por grupo/colaborador
│   ├── health.py        # GET /health
│   └── auth.py          # POST /auth/token
│
├── core/                # Configurações e infraestrutura
│   ├── config.py        # Settings (pydantic-settings)
│   ├── security.py      # JWT + API Key
│   ├── logging.py       # structlog setup
│   └── scheduler.py     # APScheduler setup
│
├── db/                  # Banco de dados
│   ├── base.py          # SQLAlchemy base declarativa
│   ├── session.py       # Engine + SessionLocal
│   └── init_db.py       # Criação inicial de tabelas
│
├── models/              # SQLAlchemy ORM models
│   ├── message.py
│   ├── conversation.py
│   ├── participant.py
│   ├── summary.py
│   ├── alert.py
│   ├── opportunity.py
│   ├── risk.py
│   ├── followup.py
│   ├── metrics.py
│   ├── source.py
│   └── processing.py
│
├── schemas/             # Pydantic schemas (request/response)
│   └── *.py
│
├── services/            # Lógica de negócio
│   ├── analysis/        # Motor de análise
│   │   ├── heuristics.py    # Regras de detecção
│   │   ├── sentiment.py     # Análise de sentimento
│   │   ├── classifier.py    # Classificador de risco/oportunidade
│   │   └── summarizer.py    # Geração de resumo
│   ├── ingestion/       # Processamento de entrada
│   │   ├── processor.py     # Pipeline de ingestão
│   │   └── validator.py     # Validação de payload
│   └── jobs/            # Jobs agendados
│       ├── daily_summary.py
│       ├── alert_scan.py
│       └── metrics_update.py
│
├── connectors/          # Abstrações de origem de dados
│   ├── base.py          # BaseIngestionConnector (ABC)
│   ├── webhook.py       # WebhookConnector
│   ├── csv_import.py    # CSVImportConnector
│   ├── whatsapp.py      # WhatsAppBusinessConnector (stub)
│   └── omnichannel.py   # OmnichannelConnector (stub)
│
└── utils/               # Helpers
    ├── text.py          # Normalização de texto
    └── datetime.py      # Helpers de datas
```

### 2.2 Frontend (Dashboard)

```
frontend/
├── public/
│   └── index.html       # SPA leve, single file por página
├── src/
│   ├── pages/
│   │   ├── dashboard.html   # Visão geral executiva
│   │   ├── alerts.html      # Alertas
│   │   ├── groups.html      # Resumo por grupo
│   │   └── team.html        # Performance colaboradores
│   ├── components/
│   │   └── *.js             # Componentes reutilizáveis
│   └── lib/
│       └── api.js           # Client da API
```

### 2.3 Infra

```
docker-compose.yml         # Orquestração local/VPS
├── postgres               # PostgreSQL 15
├── backend                # FastAPI app
└── frontend               # Nginx servindo static files
```

---

## 3. Fluxo de Ingestão

```
1. Origem externa (webhook/CSV/API) envia payload
2. POST /api/v1/ingest/messages (valida API Key)
3. IngestionProcessor valida e normaliza o payload
4. Identifica/cria Conversation e Participant
5. Salva Message no banco
6. Enfileira análise assíncrona (ou processa inline no MVP)
7. HeuristicsEngine analisa a mensagem
8. Atualiza flags: sentiment, risk_score, opportunity_score, followup_needed
9. Verifica se gera AlertEvent
10. Resposta 201 com ID da mensagem
```

---

## 4. Fluxo de Análise

```
[Trigger: nova mensagem OU job agendado]
    │
    ▼
HeuristicsEngine
    ├── detect_keywords()      → risk/opportunity tags
    ├── detect_sentiment()     → positive/neutral/negative/critical
    ├── detect_followup()      → followup_needed flag
    ├── detect_promise()       → promise_detected flag
    ├── detect_urgency()       → urgency_level
    └── score_message()        → risk_score (0-100), opp_score (0-100)
    │
    ▼
AlertScanner
    ├── Verifica thresholds configuráveis
    ├── Cria AlertEvent se limiar atingido
    └── Define severity: low/medium/high/critical
    │
    ▼
CollaboratorMetrics (job periódico)
    └── Atualiza métricas de response_time, follow-up rate, etc.
```

---

## 5. Fluxo de Resumo Diário

```
[Job: todo dia às 06:00 (configurável)]
    │
    ▼
DailySummaryJob
    ├── Busca todas as mensagens do dia anterior
    ├── Agrupa por Conversation
    ├── Para cada grupo:
    │   ├── Calcula stats (volume, sentimento médio, etc.)
    │   ├── Extrai highlights (alertas, oportunidades, riscos)
    │   └── Monta DailySummary por grupo
    ├── Consolida visão geral do dia
    └── Salva DailySummary (global) no banco
```

---

## 6. Fluxo de Alertas

```
[Trigger: inline na ingestão OU AlertScanJob (a cada N min)]
    │
    ▼
AlertScanner.scan_message(message)
    ├── Regra: risk_score >= 70 → AlertEvent(high)
    ├── Regra: sentiment == critical → AlertEvent(critical)
    ├── Regra: followup_needed sem resposta há X horas → AlertEvent(medium)
    ├── Regra: opportunity_score >= 60 → AlertEvent(low, tipo=opportunity)
    └── Regra: colaborador com alta taxa de atrito → AlertEvent(medium)
    │
    ▼
AlertEvent salvo no banco
    ├── status: open
    ├── severity: low/medium/high/critical
    └── [futuro] dispatch para canal de notificação
```

---

## 7. Fluxo do Dashboard

```
[Usuário acessa dashboard.html]
    │
    ▼
GET /api/v1/dashboard/overview
    ├── total_messages_today
    ├── active_conversations
    ├── open_alerts (por severity)
    ├── opportunities_detected
    ├── followups_pending
    ├── avg_response_time_minutes
    └── temperature_score (0-100)
    │
    ▼
GET /api/v1/summaries/today
GET /api/v1/alerts?status=open
GET /api/v1/metrics/groups
GET /api/v1/metrics/collaborators
    │
    ▼
Dashboard renderiza com dados atuais
```

---

## 8. Integrações Futuras (Preparadas)

| Integração | Tipo | Status |
|-----------|------|--------|
| WhatsApp Business API | Conector | stub pronto |
| Omnichannel (Zendesk, etc.) | Conector | stub pronto |
| OpenAI/Claude (resumo LLM) | Serviço plugável | interface pronta |
| Slack/e-mail (alertas) | Notificador | interface pronta |
| Auth0/SSO | Auth | preparado |
| S3/MinIO (anexos) | Storage | planejado |

---

## 9. Segurança e LGPD

- API Keys para ingestão (fontes externas)
- JWT para autenticação de usuários no dashboard
- Logs sem exposição de conteúdo de mensagens por padrão
- Variáveis sensíveis SEMPRE em .env (nunca hardcoded)
- Retenção de dados configurável via env var (padrão: 90 dias)
- Campo `masked_content` preparado no modelo para anonimização futura
- Rastreabilidade: `ProcessingRun` registra cada execução de análise
- `IngestionSource` identifica e audita de onde vieram os dados
