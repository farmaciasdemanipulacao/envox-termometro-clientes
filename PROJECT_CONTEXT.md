# ENVOX Intelligence — PROJECT CONTEXT

> **Arquivo vivo.** Atualizar sempre que o escopo, stack ou status mudar.
> Última atualização: 2026-06-16 | Versão: 0.1.0

---

## 1. Visão do Produto

**ENVOX Intelligence** é uma plataforma de inteligência operacional para a empresa ENVOX.

O produto lê, consolida e analisa conversas de atendimento — originadas principalmente pelo WhatsApp — e entrega ao dono da empresa e à liderança:

- Visibilidade executiva da operação em tempo real / diária
- Alertas preventivos antes que problemas virem crises
- Detecção de oportunidades comerciais
- Avaliação do comportamento de clientes e colaboradores
- Termômetro operacional com indicadores de risco, churn e clima

---

## 2. Problema Central

O dono da ENVOX não consegue acompanhar 10–15 grupos/fluxos de atendimento WhatsApp em tempo real.

**Consequências hoje:**
- Problemas e insatisfações passam despercebidos até virar crise
- Follow-ups são perdidos ou atrasados
- Oportunidades comerciais não são detectadas a tempo
- Performance dos colaboradores não é mensurada
- Não há visibilidade consolidada da operação

---

## 3. Objetivo do MVP

Entregar um sistema funcional que:

1. Ingere mensagens de múltiplas origens (via ingestão genérica/desacoplada)
2. Armazena em PostgreSQL com modelo estruturado
3. Aplica análise heurística de risco, oportunidade, sentimento e follow-up
4. Gera resumo executivo diário consolidado
5. Dispara alertas categorizados por severidade
6. Exibe dashboard web executivo com visão geral, métricas e tendências

---

## 4. Escopo do MVP (v0.1)

### IN SCOPE
- API de ingestão genérica (webhook, CSV/JSON)
- Modelo de dados completo (Message, Conversation, Participant, etc.)
- Análise heurística de mensagens (regras extensíveis)
- Resumo diário por grupo e consolidado
- Sistema de alertas com severidade
- Dashboard web (HTML + JS vanilla / leve)
- Seeds de dados realistas para demonstração
- Docker-compose para VPS Linux
- Autenticação básica (API key + login simples)
- Documentação técnica completa

### OUT OF SCOPE (MVP)
- Integração direta com WhatsApp Web/baileys (risco de instabilidade)
- WhatsApp Business API real (depende de acesso WABA)
- IA generativa em produção (GPT/Claude em cada mensagem — custo alto)
- App mobile
- Multi-tenant (multi-empresa)
- Notificações push / Slack / e-mail (preparado, não implementado)
- Relatórios PDF exportáveis
- Permissões granulares por usuário

---

## 5. Stack Escolhida

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Backend | FastAPI (Python 3.11) | Rápido, assíncrono, documentação automática |
| ORM | SQLAlchemy 2.x async | Robusto, migrations via Alembic |
| Migrations | Alembic | Padrão de mercado para SQLAlchemy |
| Banco | PostgreSQL 15 | Confiável, suporta JSONB, full-text search |
| Jobs | APScheduler (in-process) | Simples, sem Redis no MVP |
| Frontend | HTML + TailwindCSS CDN + Vanilla JS | Zero build, zero custo, fácil manutenção |
| Auth | JWT simples + API Key | Evoluível para OAuth2 |
| Containerização | Docker + docker-compose | Padrão VPS |
| Proxy reverso | Nginx (opcional no MVP) | TLS + roteamento |
| Logs | structlog | Logs estruturados em JSON |
| Configuração | pydantic-settings + .env | Validação de config em startup |

---

## 6. Premissas

1. WhatsApp real NÃO é integrado no MVP — usamos ingestão genérica
2. Volume inicial: ~10–15 grupos, ~500–2000 mensagens/dia
3. Processamento em lote (não streaming) para reduzir custo
4. IA sofisticada (LLM) é opcional e plugável — não obrigatória no MVP
5. Um único servidor VPS Linux é suficiente para o MVP
6. O dono da empresa é o principal usuário do dashboard
7. Os dados são sensíveis — LGPD deve ser considerada desde a arquitetura

---

## 7. Restrições

- Custo operacional baixo (sem serviços pagos obrigatórios no MVP)
- Sem dependência de APIs pagas por mensagem no início
- Deve rodar em VPS de 2–4 vCPU / 4–8GB RAM confortavelmente
- Código deve ser mantenível por dev Python mediano

---

## 8. Status Atual

| Componente | Status |
|------------|--------|
| Arquivos de contexto | ✅ Criados |
| Scaffold do projeto | ✅ Em andamento |
| Modelos de dados | 🔄 Em progresso |
| API base (FastAPI) | 🔄 Em progresso |
| Heurísticas de análise | ⏳ Pendente |
| Resumo diário | ⏳ Pendente |
| Alertas | ⏳ Pendente |
| Dashboard web | ⏳ Pendente |
| Seeds de dados | ⏳ Pendente |
| Docker-compose | ⏳ Pendente |
| Testes básicos | ⏳ Pendente |

---

## 9. Equipe / Roles (Time Técnico Simulado)

Este projeto é desenvolvido com perspectiva multi-disciplinar:

- **PM**: define escopo, prioridades, critérios de aceitação
- **Arquiteto**: define camadas, contratos, decisões estruturais
- **Backend**: FastAPI, modelos, serviços, jobs
- **Frontend**: dashboard, UX executiva
- **Dados**: modelo, seeds, queries analíticas
- **IA**: heurísticas, scoring, preparação para LLM
- **DevOps**: docker, deploy, observabilidade
- **Segurança/LGPD**: auth, logs, retenção
- **QA**: seeds, validação, edge cases
