# PRD — Pós-call Intelligence (NossoCRM)

**Data:** 22/12/2025  
**Produto:** NossoCRM (Next.js App Router + Supabase, multi-tenant por `organizationId`)  
**Status:** Proposta  
**Stakeholders:** Produto, Engenharia, CS/Operações, Jurídico/Privacidade  

**Premissas técnicas do repo:**
- Rotas em `app/api/*` (Route Handlers)
- Multi-tenant: tudo deve filtrar por `organization_id` (RLS + service role com filtro explícito)
- Proxy **não intercepta `/api/*`** → endpoints devem responder **401/403** (sem redirects)
- Stack de IA principal: `POST /api/ai/chat` + `lib/ai/tools.ts` (service role; sempre filtrar por `organization_id`)
- Chaves/modelo de IA: **org-wide** em `organization_settings` (fonte de verdade)

---

## 1) Visão geral

Implementar uma feature de **Pós-call Intelligence** para chamadas (voz) no CRM, cobrindo:

1) **Gravação** (ingestão/upload do áudio + metadados)  
2) **Transcrição em batch** (assíncrona; sem streaming em tempo real)  
3) **Resumo automático com IA** (pontos-chave, objeções, próximos passos, follow-ups)  
4) **Scorecards/QA** (avaliação por rubrica: aderência a playbook, compliance, qualidade)

O foco é transformar chamadas já finalizadas em **insumos acionáveis** dentro do CRM (contatos, deals, atividades), com governança multi-tenant e controles de privacidade/LGPD.

---

## 2) Problema

- Times comerciais e CS perdem tempo revisando gravações longas e anotando manualmente.
- Falta padronização de QA e rastreabilidade das avaliações.
- Insights importantes (objeções, intenções, próximos passos) não viram tarefas/atividades no CRM.
- Sem estrutura, coaching e melhoria contínua do playbook ficam subjetivos e lentos.

---

## 3) Objetivos

- Reduzir esforço manual pós-chamada com **transcrição + resumo + ações** automáticos.
- Garantir **qualidade e consistência** via scorecards/QA por template.
- Conectar resultados ao CRM: **deal/contato/atividades**.
- Operar com **segurança, privacidade e multi-tenancy** (LGPD, auditoria, retenção).

### Métricas-alvo (MVP)

- % de chamadas com transcrição concluída dentro do SLA definido (ex.: < 15 min após upload)
- Taxa de sucesso do pipeline (upload→transcrição→resumo→scorecard) ≥ 95%
- Adoção: % de chamadas com resumo visualizado / action items aplicados
- Redução de tempo de “pós-call administrativo” (auto-reportado)
- Satisfação interna (líderes/QA) com utilidade do scorecard

---

## 4) Fora de escopo (explícito)

- **Coaching em tempo real** durante a chamada
- **Media Streams / WebSocket** e captura de áudio ao vivo no navegador
- **Roteamento inbound complexo / filas / URA** (contact center)
- Substituir o provedor de telefonia existente (vamos ingerir gravações/eventos)
- Garantir 100% de precisão do resumo/QA (IA pode errar; haverá mitigação)

---

## 5) Personas

1) **SDR/Closer (Vendas)**: quer resumo, objeções e próximos passos, sem burocracia.
2) **CSM (CS)**: quer riscos/compromissos registrados e histórico confiável.
3) **Líder de Vendas/CS**: quer QA padronizado e coaching assíncrono.
4) **QA/Operações**: quer rubricas versionadas e auditoria das avaliações.
5) **Admin da Organização**: quer configurar retenção, flags e permissões.

---

## 6) Jornada do usuário

1) Chamada acontece (fora do CRM ou via integração futura).
2) Usuário cria/seleciona registro de call no CRM e **anexa gravação** (upload) ou gravação chega via webhook.
3) Sistema muda status: `recording_uploaded` → enfileira transcrição.
4) Sistema conclui transcrição e gera **resumo IA** e **scorecard**.
5) UI exibe: player/arquivo, transcrição pesquisável, resumo, action items, scorecard com evidências.
6) Usuário confirma/edita action items → cria tarefas/atividades no CRM.
7) Líder revisa scorecard, ajusta notas e registra feedback.

---

## 7) Requisitos funcionais

### 7.1 Ingestão de gravação

- Criar “Call Session” vinculada a `organization_id` (obrigatório) e opcional `contact_id`/`deal_id`.
- Upload de áudio via Supabase Storage (privado), segregado por organização.
- Capturar metadados: direção, participantes, timestamps, duração (quando disponível), provedor/origem.
- Estados do processamento:  
  `created` → `recording_uploaded` → `transcription_queued` → `transcribed` → `summary_generated` → `scorecard_generated` (com estados `failed_*`).

### 7.2 Transcrição (batch/assíncrona)

- Job inicia ao concluir upload.
- Suporte a idioma por org/call (pt-BR default).
- Diarização (falante A/B) opcional no MVP (dependente do provedor).
- Persistir: texto, segmentos (timestamps), confiança média, status e erro.

### 7.3 Resumo com IA automático

- Rodar automaticamente após transcrição (configurável por organização).
- Saída estruturada (JSON), contendo:  
  resumo executivo, tópicos, objeções, riscos, próximos passos, perguntas abertas, itens acionáveis.
- Exibir aviso “gerado por IA” + botão de feedback (útil/não útil + comentário).

### 7.4 Scorecards / QA

- Templates por organização (versionados), com critérios/pesos/exemplos.
- Avaliação automática: nota por critério + nota total + evidências (trechos do transcript).
- Revisão humana: ajustar nota e comentar; auditar alterações (quem/quando).

### 7.5 Integração com CRM

- Vincular call a deal/contato.
- Action items podem virar tarefas/atividades no CRM (com backlink para a call).
- Listagem e filtros: por período, deal, contato, status, nota QA, tags.

### 7.6 Multi-tenancy e permissões

- Acesso respeitando `organization_id`.
- Papéis (alto nível): rep (próprias/permitidas), líder/QA (time), admin (configuração).

---

## 8) Requisitos não funcionais

### 8.1 Segurança

- RLS para todas as tabelas com `organization_id`.
- Service role apenas onde necessário; ainda assim filtrar por `organization_id`.
- Storage privado + URLs assinadas com expiração curta para playback.
- Endpoints `/api/*` retornam 401/403, sem redirects (compatível com o proxy do projeto).

### 8.2 Privacidade/LGPD

- Registrar consentimento/aviso quando aplicável (fonte e timestamp).
- Minimização: permitir desativar transcrição, resumo e QA por org/call.
- Retenção configurável e exclusão/anonimização sob solicitação (DSAR).
- Transparência: informar uso de IA e provedores terceiros, quando aplicável.

### 8.3 Retenção e descarte

- Retenção separada de áudio e transcript (ex.: áudio 30 dias, transcript 180 dias).
- Job agendado de expurgo com logs de auditoria.

### 8.4 Confiabilidade

- Pipeline assíncrono (jobs) para evitar timeouts.
- Idempotência em todos os steps (reprocessar sem duplicar registros).
- Retries com backoff e estados `failed` visíveis.

---

## 9) Modelo de dados sugerido (Supabase/Postgres)

> Observação: nomes podem ser ajustados ao schema atual. Todas as tabelas incluem `organization_id` (NOT NULL) e índices.

### `call_sessions`

- `id` (uuid, pk)
- `organization_id` (uuid, index)
- `created_by` (uuid)
- `deal_id` (uuid, nullable, index)
- `contact_id` (uuid, nullable, index)
- `direction` (text: inbound/outbound)
- `started_at`, `ended_at`, `duration_seconds`
- `provider` (text: manual_upload, twilio, etc.)
- `external_call_id` (text, nullable; unique por org+provider)
- `status` (text/enum)
- `consent_status` (text, nullable)
- `created_at`, `updated_at`

### `call_recordings`

- `id` (uuid, pk)
- `organization_id`
- `call_session_id` (uuid, fk)
- `storage_bucket`, `storage_path`
- `mime_type`, `size_bytes`, `checksum` (optional)
- `uploaded_at`, `deleted_at` (nullable)

### `call_transcripts`

- `id` (uuid, pk)
- `organization_id`
- `call_session_id` (uuid, fk)
- `provider`, `language`
- `transcript_text` (text)
- `segments` (jsonb: `[{start_ms,end_ms,speaker,text,confidence}]`)
- `confidence_avg` (numeric)
- `status` (`queued|processing|done|failed`), `error_message`
- `created_at`, `completed_at`

### `call_ai_summaries`

- `id` (uuid, pk)
- `organization_id`
- `call_session_id` (uuid, fk)
- `input_transcript_id` (uuid, fk)
- `summary_json` (jsonb)
- `model`, `tokens_in`, `tokens_out`, `cost_usd` (optional)
- `status`, `error_message`
- `created_at`, `completed_at`

### `qa_scorecard_templates`

- `id` (uuid, pk)
- `organization_id`
- `name`, `version`
- `criteria` (jsonb: pesos, descrições, exemplos)
- `is_active` (bool)
- `created_by`, `created_at`

### `qa_evaluations`

- `id` (uuid, pk)
- `organization_id`
- `call_session_id` (uuid, fk)
- `template_id`, `template_version`
- `evaluation_json` (jsonb: notas, evidências, justificativas)
- `total_score` (numeric)
- `status` (`auto_generated|reviewed|overridden|failed`)
- `reviewed_by`, `review_notes`
- `created_at`, `updated_at`

### (Opcional) `call_processing_jobs`

- controla fila/idempotência: `job_type`, `status`, `attempts`, `run_after`, locks, erro.

---

## 10) Endpoints e webhooks (alto nível)

### API interna

- `POST /api/calls` cria sessão e retorna instruções de upload.
- `POST /api/calls/{callId}/recording/complete` confirma upload e enfileira transcrição.
- `GET /api/calls` / `GET /api/calls/{callId}` lista/detalha status e artefatos.
- `POST /api/calls/{callId}/actions/apply` cria tasks/atividades a partir de action items.
- Admin QA: `POST/PUT/GET /api/qa/templates`.

### Webhooks externos (se houver provedor)

- `POST /api/webhooks/telephony/{provider}` ingestão de evento/gravação.
- `POST /api/webhooks/transcription/{provider}` callback de transcrição (ou polling).

Todos webhooks devem validar assinatura/token e mapear com segurança para `organization_id`.

---

## 11) Flags/config por organização (`organization_settings`)

Exemplos:
- `post_call_intelligence_enabled`
- `recording_retention_days`
- `transcript_retention_days`
- `auto_transcribe_enabled`
- `auto_summarize_enabled`
- `auto_scorecard_enabled`
- `default_language`
- `transcription_provider` + credenciais (server-only)
- `qa_default_template_id`
- `pii_redaction_enabled` (futuro)
- `allowed_roles_for_audio_access`

---

## 12) Observabilidade e métricas

- Correlation por `call_session_id` em logs.
- Eventos por step (done/failed) + latências.
- Custos estimados (tokens/custo IA, custo transcrição) por call e por org.
- Dashboards: SLA, taxa de falhas, custo por 100 calls, adoção (views, action items aplicados, QA revisado).

---

## 13) Rollout / Fases

**Fase 0 (interno):** schema + RLS + storage + estados + jobs + logs.  
**Fase 1 (MVP):** upload manual + transcrição batch + resumo IA + 1 template de scorecard + UI básica.  
**Fase 2:** integração com 1 provedor via webhook + busca/highlights + feedback loop.  
**Fase 3:** retenção automática + otimização de custo + relatórios agregados.

---

## 14) Riscos e mitigação

- Vazamento cross-tenant → RLS + filtros explícitos + testes multi-tenant.
- Custos imprevisíveis → limites por org + flags + rate limits + dashboards de custo.
- Hallucination → evidências com trechos + revisão humana + feedback.
- LGPD/consentimento → registros, retenção, transparência e processos de exclusão.
- Falhas de provedor → retries + estados claros + reprocessamento idempotente.

---

## 15) Questões em aberto

1) Qual provedor de transcrição primeiro (custo/pt-BR/diarização)?
2) Diarização é requisito do MVP?
3) Retenção padrão (áudio vs transcript) por org/segmento?
4) Precisamos de PII redaction desde o MVP?
5) Permissões de acesso ao áudio/transcript (papéis) e exceções por org?
6) Scorecard: um template padrão ou múltiplos por pipeline/time?
7) Onde na UI isso vive (Deal, Contact, Activity timeline, ou entidade Calls)?
