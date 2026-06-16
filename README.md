# ENVOX Intelligence 🧠

> Plataforma de Inteligência Operacional para Atendimento — MVP v0.1.0

---

## O que é

ENVOX Intelligence é uma plataforma que monitora conversas de atendimento (WhatsApp, CRMs, omnichannel) e entrega ao dono da ENVOX:

- 📊 **Dashboard executivo** com visão geral da operação em tempo real
- 🚨 **Alertas preventivos** de risco, churn, escaladas e oportunidades
- 📋 **Resumo diário** consolidado da operação
- 🌡️ **Termômetro operacional** com score 0-100
- 👥 **Performance** de colaboradores e grupos

---

## Início Rápido (Desenvolvimento Local)

### Pré-requisitos
- Docker + docker-compose
- Python 3.11+ (para rodar seeds localmente)

### 1. Configurar ambiente
```bash
cp .env.example .env
# Edite .env se necessário (as configurações padrão funcionam para dev)
```

### 2. Subir os serviços
```bash
docker compose up -d
```

### 3. Aguardar o banco e backend subirem (~30s)
```bash
docker compose ps
docker compose logs -f backend --tail=30
```

### 4. Carregar dados de demonstração
```bash
# Dentro do container backend:
docker compose exec backend python /app/../seeds/seed_data.py

# Ou rodando localmente (com .env configurado):
cd backend
pip install -r requirements.txt
cd ..
DATABASE_URL="postgresql+asyncpg://envox:envox123@localhost:5432/envox_intel" python seeds/seed_data.py
```

### 5. Acessar
| Serviço | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

**Login padrão:** `admin` / `admin123`

---

## Estrutura do Projeto

```
envox-intel/
├── backend/               # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/routes/    # Endpoints REST
│   │   ├── models/        # SQLAlchemy ORM
│   │   ├── schemas/       # Pydantic validation
│   │   ├── services/      # Lógica de negócio
│   │   │   ├── analysis/  # Motor de heurísticas + resumos
│   │   │   └── ingestion/ # Pipeline de ingestão
│   │   ├── connectors/    # Conectores de origem (CSV, WhatsApp stub)
│   │   └── core/          # Config, auth, logging, scheduler
│   ├── migrations/        # Alembic migrations
│   └── requirements.txt
├── frontend/
│   └── public/
│       └── index.html     # Dashboard web (HTML + TailwindCSS + Vanilla JS)
├── seeds/
│   └── seed_data.py       # Dados de demonstração
├── infra/nginx/           # Configuração Nginx
├── docs/                  # Documentação adicional
├── docker-compose.yml
├── .env.example
├── PROJECT_CONTEXT.md     # Contexto vivo do produto
├── ARCHITECTURE.md        # Arquitetura detalhada
├── DECISIONS.md           # Log de decisões técnicas
├── ROADMAP.md             # Roadmap e próximos passos
├── DATA_MODEL.md          # Modelo de dados
└── DEPLOY.md              # Guia de deploy em VPS
```

---

## Ingestão de Mensagens

### Via API (Webhook)

```bash
# Autenticar e obter token
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Ingerir uma mensagem (API Key necessária para ingestão)
curl -X POST http://localhost:8000/api/v1/ingest/message \
  -H "Content-Type: application/json" \
  -H "X-API-Key: envox-default-api-key-mude-em-producao" \
  -d '{
    "conversation_external_id": "grupo-clientes-001",
    "conversation_name": "Clientes VIP - Suporte",
    "participant_external_id": "5511999991234",
    "participant_name": "João Silva",
    "participant_role": "customer",
    "content": "Preciso cancelar meu contrato urgente!",
    "message_type": "text",
    "sent_at": "2024-06-16T10:30:00Z"
  }'
```

### Via Importação em Lote

```bash
# Importar arquivo CSV
curl -X POST http://localhost:8000/api/v1/ingest/batch \
  -H "X-API-Key: envox-default-api-key-mude-em-producao" \
  -H "Content-Type: application/json" \
  -d @examples/batch_messages.json
```

---

## Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/auth/token` | Login JWT |
| POST | `/api/v1/ingest/message` | Ingerir mensagem única |
| POST | `/api/v1/ingest/batch` | Ingestão em lote |
| GET | `/api/v1/dashboard/overview` | KPIs executivos |
| GET | `/api/v1/dashboard/groups` | Métricas por grupo |
| GET | `/api/v1/alerts` | Listar alertas |
| PATCH | `/api/v1/alerts/{id}` | Atualizar status alerta |
| GET | `/api/v1/summaries/today` | Resumo do dia |
| POST | `/api/v1/summaries/generate` | Forçar geração de resumo |
| GET | `/api/v1/health` | Healthcheck |

---

## Stack Técnica

| Componente | Tecnologia |
|-----------|-----------|
| Backend | FastAPI 0.115 + Python 3.11 |
| ORM | SQLAlchemy 2.x async |
| Migrations | Alembic |
| Banco | PostgreSQL 15 |
| Jobs | APScheduler |
| Frontend | HTML + TailwindCSS CDN + Vanilla JS |
| Auth | JWT (dashboard) + API Key (ingestão) |
| Containerização | Docker + docker-compose |

---

## Configurações Importantes (.env)

```env
# Credenciais admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=TROQUE_EM_PRODUCAO

# API Key para ingestão
API_KEY_SECRET=envox-default-api-key-mude-em-producao

# Segurança
SECRET_KEY=GERE_UMA_CHAVE_SECRETA_64_CHARS

# IA (opcional)
LLM_ENABLED=false
OPENAI_API_KEY=  # Deixe vazio para usar só heurísticas

# Retenção de dados (LGPD)
DATA_RETENTION_DAYS=90
```

---

## Documentação do Projeto

| Arquivo | Conteúdo |
|---------|----------|
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Visão do produto, escopo, status |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitetura, fluxos, componentes |
| [DECISIONS.md](DECISIONS.md) | Decisões técnicas e trade-offs |
| [ROADMAP.md](ROADMAP.md) | Fases, backlog, próximos passos |
| [DATA_MODEL.md](DATA_MODEL.md) | Entidades e relacionamentos |
| [DEPLOY.md](DEPLOY.md) | Deploy em VPS, backup, troubleshooting |

---

## Status do MVP

- ✅ Arquitetura modular e documentada
- ✅ Modelo de dados completo (10 entidades)
- ✅ API REST com FastAPI (auth, ingestão, dashboard, alertas, resumos)
- ✅ Motor de heurísticas (detecção de risco, churn, oportunidade, follow-up)
- ✅ Geração de resumo diário automática
- ✅ Sistema de alertas em tempo real
- ✅ Dashboard web executivo responsivo
- ✅ Seeds de dados realistas (~450 mensagens)
- ✅ Docker-compose para deploy imediato
- ✅ Conectores base (CSV funcional, WhatsApp stub documentado)
- ✅ Autenticação JWT + API Key
- ✅ Scheduler de jobs (APScheduler)
- ✅ Documentação completa

---

**ENVOX Intelligence** — Versão 0.1.0 | MVP
