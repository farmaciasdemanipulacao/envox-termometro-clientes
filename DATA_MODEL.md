# ENVOX Intelligence — DATA MODEL

> Última atualização: 2026-06-16

---

## Entidades Principais

### 1. IngestionSource
Representa a origem dos dados (de onde as mensagens vieram).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| name | str | Nome amigável (ex: "WhatsApp Grupo Clientes VIP") |
| source_type | enum | webhook / csv / whatsapp_api / omnichannel / manual |
| config | JSONB | Configurações específicas do conector |
| api_key_hash | str | Hash da API Key deste conector |
| is_active | bool | Ativo/inativo |
| created_at | timestamp | Criação |
| last_ingestion_at | timestamp | Última ingestão bem-sucedida |

**Rationale:** Auditoria de origem. Permite rastrear de onde cada dado veio. Essencial para LGPD (art. 26 — responsabilidade do operador).

---

### 2. Conversation
Representa um grupo, thread ou conversa (ex: grupo WhatsApp, ticket).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| source_id | UUID FK | Origem dos dados |
| external_id | str | ID na plataforma de origem |
| name | str | Nome do grupo/conversa |
| conversation_type | enum | group / individual / ticket |
| is_active | bool | Ainda ativo? |
| participant_count | int | Qtd de participantes |
| sla_response_minutes | int | SLA configurado (tempo máximo de resposta) |
| metadata | JSONB | Dados extras flexíveis |
| created_at | timestamp | Criação |
| updated_at | timestamp | Última atualização |

**Rationale:** Ponto central de agregação. Cada grupo WhatsApp = 1 Conversation.

---

### 3. Participant
Representa qualquer pessoa na conversa (cliente, colaborador, gestor).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| external_id | str | ID na plataforma de origem |
| name | str | Nome |
| phone | str (masked) | Telefone (mascarado por padrão) |
| email | str | E-mail (opcional) |
| role | enum | customer / collaborator / manager / bot / unknown |
| is_internal | bool | Pertence à ENVOX? |
| metadata | JSONB | Dados extras |
| created_at | timestamp | Criação |
| updated_at | timestamp | Atualização |

**Rationale:** Distinguir clientes de colaboradores é fundamental para análise diferenciada de comportamento e performance.

---

### 4. Message
Entidade central. Cada mensagem individual do atendimento.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| conversation_id | UUID FK | Conversa à qual pertence |
| participant_id | UUID FK | Quem enviou |
| source_id | UUID FK | Origem da ingestão |
| external_id | str | ID original na plataforma |
| content | text | Texto completo da mensagem |
| masked_content | text | Versão mascarada (LGPD) — null se não aplicado |
| message_type | enum | text / image / audio / video / document / system |
| sent_at | timestamp | Quando foi enviada (timestamp original) |
| ingested_at | timestamp | Quando foi ingerida no sistema |
| processed_at | timestamp | Quando foi analisada |
| — CAMPOS DE ANÁLISE — | | |
| sentiment | enum | positive / neutral / negative / critical / unknown |
| sentiment_score | float | -1.0 a 1.0 |
| risk_score | int | 0-100 (maior = maior risco) |
| opportunity_score | int | 0-100 (maior = maior oportunidade) |
| urgency_level | enum | none / low / medium / high / critical |
| — FLAGS — | | |
| is_followup_needed | bool | Precisa de follow-up? |
| is_promise_detected | bool | Tem promessa/compromisso? |
| is_complaint | bool | É reclamação? |
| is_escalation | bool | Escalada de tensão? |
| is_opportunity | bool | É oportunidade comercial? |
| is_internal_friction | bool | Atrito interno? |
| — TAGS — | | |
| tags | JSONB | Lista de tags detectadas |
| raw_payload | JSONB | Payload original de ingestão (para auditoria) |

**Rationale:** Campos de análise preenchidos pelo HeuristicsEngine. Flags booleanas para queries rápidas. JSONB para tags extensíveis sem migration.

---

### 5. AlertEvent
Alerta gerado pelo sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| conversation_id | UUID FK | Conversa relacionada |
| message_id | UUID FK | Mensagem que disparou (opcional) |
| participant_id | UUID FK | Participante relacionado (opcional) |
| alert_type | enum | risk / opportunity / followup_delay / friction / sla_breach / churn |
| severity | enum | low / medium / high / critical |
| title | str | Título curto do alerta |
| description | text | Descrição completa |
| excerpt | text | Trecho da mensagem que disparou |
| status | enum | open / acknowledged / resolved / dismissed |
| triggered_at | timestamp | Quando foi disparado |
| resolved_at | timestamp | Quando foi resolvido |
| metadata | JSONB | Dados extras |

---

### 6. DailySummary
Resumo diário gerado pelo job.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| summary_date | date | Data do resumo |
| conversation_id | UUID FK | Null = resumo global; preenchido = resumo por grupo |
| summary_type | enum | global / per_conversation |
| — TEXTO — | | |
| executive_text | text | Texto narrativo do resumo |
| highlights | JSONB | Lista de destaques (strings) |
| critical_points | JSONB | Pontos críticos |
| opportunities | JSONB | Oportunidades detectadas |
| — MÉTRICAS DO DIA — | | |
| total_messages | int | Total de mensagens |
| total_participants | int | Participantes ativos |
| avg_sentiment_score | float | Sentimento médio |
| risk_score_avg | float | Risco médio |
| open_alerts_count | int | Alertas abertos |
| followups_pending | int | Follow-ups pendentes |
| avg_response_minutes | float | Tempo médio de resposta |
| — TERMÔMETRO — | | |
| temperature_score | int | 0-100 (saúde geral da operação) |
| temperature_label | enum | excellent / good / attention / warning / critical |
| generated_at | timestamp | Quando foi gerado |
| generation_method | enum | heuristic / llm / hybrid |

---

### 7. FollowUpItem
Follow-ups pendentes detectados.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| conversation_id | UUID FK | Conversa |
| message_id | UUID FK | Mensagem que gerou o follow-up |
| assigned_to | UUID FK | Colaborador responsável (Participant) |
| title | str | Descrição do follow-up |
| due_at | timestamp | Prazo (estimado ou explícito) |
| status | enum | pending / completed / overdue / cancelled |
| detected_at | timestamp | Quando foi detectado |
| resolved_at | timestamp | Quando foi resolvido |

---

### 8. CollaboratorMetric
Métricas diárias por colaborador.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| participant_id | UUID FK | Colaborador |
| metric_date | date | Data |
| messages_sent | int | Mensagens enviadas |
| conversations_handled | int | Conversas atendidas |
| avg_response_minutes | float | Tempo médio de resposta |
| followups_pending | int | Follow-ups em aberto |
| followups_completed | int | Follow-ups concluídos |
| risk_conversations | int | Conversas de risco atendidas |
| opportunity_conversations | int | Conversas com oportunidade |
| friction_incidents | int | Incidentes de atrito |
| quality_score | float | Score de qualidade (0-100) |

---

### 9. ConversationMetric
Métricas diárias por conversa/grupo.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| conversation_id | UUID FK | Conversa |
| metric_date | date | Data |
| total_messages | int | Total de mensagens |
| avg_sentiment | float | Sentimento médio |
| risk_score | float | Score de risco do grupo |
| opportunity_score | float | Score de oportunidade |
| avg_response_minutes | float | Tempo médio de resposta |
| sla_breaches | int | Violações de SLA |
| followups_pending | int | Follow-ups pendentes |
| friction_count | int | Incidentes de atrito |
| temperature_score | int | Termômetro do grupo (0-100) |

---

### 10. ProcessingRun
Rastreabilidade de cada execução de processamento.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | Identificador único |
| run_type | enum | ingestion / analysis / summary / alert_scan / metrics |
| status | enum | running / success / failed / partial |
| started_at | timestamp | Início |
| finished_at | timestamp | Fim |
| items_processed | int | Itens processados |
| items_failed | int | Itens com erro |
| error_log | text | Log de erros (se houver) |
| metadata | JSONB | Informações adicionais |

---

## Relacionamentos

```
IngestionSource (1) ──── (N) Conversation
IngestionSource (1) ──── (N) Message
Conversation    (1) ──── (N) Message
Conversation    (1) ──── (N) AlertEvent
Conversation    (1) ──── (N) DailySummary
Conversation    (1) ──── (N) FollowUpItem
Conversation    (1) ──── (N) ConversationMetric
Participant     (1) ──── (N) Message
Participant     (1) ──── (N) CollaboratorMetric
Participant     (1) ──── (N) FollowUpItem
Message         (1) ──── (N) AlertEvent
Message         (1) ──── (1) FollowUpItem
```

---

## Índices Planejados

```sql
-- Queries mais frequentes
CREATE INDEX idx_messages_conversation_sent ON messages(conversation_id, sent_at DESC);
CREATE INDEX idx_messages_processed ON messages(processed_at) WHERE processed_at IS NULL;
CREATE INDEX idx_alerts_status_severity ON alerts(status, severity);
CREATE INDEX idx_alerts_conversation ON alerts(conversation_id, triggered_at DESC);
CREATE INDEX idx_summaries_date ON daily_summaries(summary_date DESC);
CREATE INDEX idx_followups_status ON follow_up_items(status) WHERE status = 'pending';
CREATE INDEX idx_messages_risk ON messages(risk_score) WHERE risk_score >= 60;
```
