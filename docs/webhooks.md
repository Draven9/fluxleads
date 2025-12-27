## Webhooks (Integrações) — Guia de uso

Este documento explica **como configurar** e **como usar** os webhooks “produto” do CRM:

- **Entrada de Leads (Webhook)**: recebe um `POST` e cria contato + negócio no funil.
- **Follow-up (Webhook de saída)**: quando um negócio muda de etapa, o CRM envia um `POST` para sua URL.

> **Acesso**: as configurações são **admin-only** (RBAC + RLS).

---

## Onde configurar (na UI)

- Vá em `Configurações → Integrações → Webhooks`.
- Você verá dois cards:
  - **Entrada de Leads (Webhook)** (inbound)
  - **Follow-up (Webhook de saída)** (outbound)

Na UI você consegue:

- **Editar** (board/etapa do inbound, URL do outbound)
- **Ativar/Desativar**
- **Excluir**
- **Copiar URL** e **Copiar secret**

---

## 1) Entrada de Leads (Webhook) — Inbound

### URL do endpoint

Quando você cria a “Entrada de Leads”, o CRM gera um `source_id` e a URL fica no formato:

- `POST {SUPABASE_URL}/functions/v1/webhook-in/<source_id>`

> A UI monta essa URL a partir do `NEXT_PUBLIC_SUPABASE_URL`.

### Autenticação (obrigatória)

Você **precisa** enviar o header:

- `X-Webhook-Secret: <secret>`

Esse secret é o “token” do webhook. Trate como senha.

### Headers recomendados

- `Content-Type: application/json`
- `X-Webhook-Secret: ...`

### Payload (JSON)

Campos aceitos (todos opcionais, mas recomenda-se enviar pelo menos `email` ou `phone`):

- `external_event_id` (string): idempotência/dedupe (recomendado)
- `name` (string)
- `email` (string)
- `phone` (string)
- `source` (string): ex. `"hotmart"`, `"n8n"`, `"make"`
- `notes` (string)
- `company_name` (string)

### Comportamento (o que o CRM faz)

Ao receber o `POST`, o handler (`supabase/functions/webhook-in/index.ts`):

- valida `X-Webhook-Secret`
- registra auditoria em `webhook_events_in` (quando `external_event_id` existe; com dedupe)
- faz **upsert de contato** por `email` e/ou `phone` (na mesma `organization_id`)
- cria um **deal** no **board/etapa** configurados na UI
- grava metadados em `deals.custom_fields`:
  - `inbound_source_id`
  - `inbound_external_event_id`

### Exemplo (cURL)

```bash
curl -X POST 'https://SEU-PROJETO.supabase.co/functions/v1/webhook-in/<source_id>' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: <secret>' \
  -d '{
    "external_event_id": "teste-123",
    "name": "Lead Teste",
    "email": "teste@exemplo.com",
    "phone": "+55...",
    "source": "webhook"
  }'
```

### Resposta (200)

O endpoint retorna algo como:

```json
{
  "ok": true,
  "organization_id": "...",
  "contact_id": "...",
  "deal_id": "..."
}
```

### Rotação do secret (inbound)

Atualmente, o inbound **não possui “regenerar secret”** na UI. Para trocar o secret:

- **Exclua** a configuração de “Entrada de Leads”
- **Crie novamente** (isso gera um novo `source_id` e um novo `secret`)

---

## 2) Follow-up (Webhook de saída) — Outbound

### Quando dispara

O CRM dispara quando um **deal muda de etapa** (`deals.stage_id` muda).

Implementação: trigger no Postgres (`notify_deal_stage_changed`) via migration  
`supabase/migrations/20251226010000_integrations_webhooks_product.sql`.

### URL de destino

Você informa na UI uma URL (ex.: n8n/Make/WhatsApp provider webhook) e o CRM faz:

- `POST <sua_url>`

### Autenticação (obrigatória)

O CRM envia o header:

- `X-Webhook-Secret: <secret do endpoint>`

> Se você regenerar o secret na UI, você precisa atualizar também no seu sistema (n8n/Make/etc).

### Payload enviado (JSON)

O payload do outbound (em `webhook_events_out.payload`) tem este formato:

```json
{
  "event_type": "deal.stage_changed",
  "occurred_at": "2025-12-26T00:00:00.000Z",
  "deal": {
    "id": "...",
    "title": "...",
    "value": 0,
    "board_id": "...",
    "board_name": "...",
    "from_stage_id": "...",
    "from_stage_label": "...",
    "to_stage_id": "...",
    "to_stage_label": "...",
    "contact_id": "..."
  },
  "contact": {
    "name": "...",
    "phone": "...",
    "email": "..."
  }
}
```

### Entrega (pg_net) e status

O envio é feito via `pg_net` (async):

- a entrega é registrada em `webhook_deliveries`
- `webhook_deliveries.request_id` guarda o id do `net.http_post(...)`
- em caso de exceção no disparo, a delivery é marcada como `failed`

> **MVP**: não existe retry/backoff automático no banco.

---

## 3) Auditoria e troubleshooting

As tabelas principais:

- `integration_inbound_sources`: configurações de inbound (admin-only)
- `integration_outbound_endpoints`: configurações de outbound (admin-only)
- `webhook_events_in`: auditoria de eventos inbound
- `webhook_events_out`: auditoria de eventos outbound
- `webhook_deliveries`: tentativas de entrega outbound

### Queries úteis (Supabase SQL editor)

Últimos inbound recebidos:

```sql
select id, received_at, status, external_event_id, error
from webhook_events_in
order by received_at desc
limit 50;
```

Últimos outbound gerados:

```sql
select id, created_at, event_type, deal_id
from webhook_events_out
order by created_at desc
limit 50;
```

Entregas outbound:

```sql
select d.id, d.attempted_at, d.status, d.request_id, d.response_status, d.error
from webhook_deliveries d
order by d.attempted_at desc
limit 50;
```

---

## 4) Segurança (recomendações)

- **Nunca** exponha o `secret` em client-side público/landing pages.
- No seu endpoint (n8n/Make/servidor), valide o header `X-Webhook-Secret`.
- Gere `external_event_id` no provedor de origem para garantir **idempotência**.
- Se suspeitar de vazamento:
  - inbound: recrie a configuração (gera novo `source_id` e secret)
  - outbound: use **Regenerar secret** e atualize o destino

