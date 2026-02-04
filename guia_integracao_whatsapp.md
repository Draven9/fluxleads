# Guia de Integração: WhatsApp (Evolution API) <-> Flux Leads

Este guia cobre três fluxos principais:
1.  **Entrada (Inbound):** Receber mensagens/leads (Cria Lead + Chat).
2.  **Resposta (Chat Outbound):** Enviar respostas manuais pela aba de Mensagens.
3.  **Follow-up (Automação):** Enviar mensagens automáticas quando um card muda de etapa no kanban.

---

## 📥 Parte 1: Entrada (WhatsApp -> Flux Leads)

Use a **Integração Nativa de Entrada de Leads**, que cria automaticamente Contatos, Negócios e inicia o Chat no Flux Leads.

### ✅ Passo 1.1: Gerar Credenciais
1.  Acesse **Configurações > Webhooks**.
2.  Clique no botão **"Como usar"** (ou "Quick Start").
3.  Na aba **"Receber leads"**, configure o funil de entrada e clique em **"Gerar URL e Secret"**.
4.  Copie a URL e o Secret.

### ⚡ Passo 1.2: Configurar no n8n
No seu workflow de recebimento (Evolution API -> Http Request):
*   **Method:** POST
*   **URL:** (Sua URL gerada)
*   **Header:** `X-Webhook-Secret`: (Seu Secret)
*   **Body (JSON):**

> [!IMPORTANT]
> **Atenção:** Use o modo **Expression** no n8n (engrenagem ao lado do campo) para que as variáveis fiquem identificadas (cor diferente de preto).

Campos Sugeridos no Body:
*   `name`: `{{ $json.body.data.pushName }}`
*   `phone`: `{{ $json.body.data.key.remoteJid.replace('@s.whatsapp.net', '') }}`
*   `source`: `whatsapp` (**Obrigatório** para ativar o chat)
*   `notes`: `{{ $json.body.data.message.conversation || $json.body.data.message.extendedTextMessage.text }}`
*   `external_event_id`: `{{ $json.body.data.key.id }}`

---

## 📤 Parte 2: Configurar Saída (Flux Leads -> n8n)

Para enviar respostas manuais ou follow-ups automáticos, você deve conectar o Flux Leads ao seu n8n.

### ✅ Passo 2.1: Cadastrar Webhook de Saída
1.  Acesse **Configurações > Webhooks**.
2.  Em **"Follow-up (Webhook de saída)"**, clique em conectar.
3.  Insira a **URL do seu Webhook do n8n** (que receberá tanto chat quanto follow-ups).

---

## 💬 Parte 3: Fluxo de Resposta de Chat (Manual)

Quando você responde um cliente pela aba **Mensagens** do Flux Leads, o sistema envia este evento:

**JSON Enviado:**
```json
{
  "event": "chat.new_message",
  "data": {
    "content": "*[Nome Atendente]:* Olá, tudo bem?",
    "contact": {
      "name": "Cliente Exemplo",
      "phone": "551199999999"
    },
    ...
  }
}
```

---

## 🚀 Parte 4: Fluxo de Follow-up (Mudança de Etapa)

Quando você arrasta um card no Kanban para outra etapa, o sistema envia este evento:

**JSON Enviado:**
```json
{
  "event": "deal.stage_changed",
  "data": {
    "deal_id": "uuid...",
    "title": "Negócio Honda Civic",
    "contact": { "name": "João", "phone": "55119999", ... },
    "from_stage": { "name": "Novos" },
    "to_stage": { "name": "Qualificados" }
  }
}
```

---

## 📦 Bônus: Workflow pronto para Copiar/Colar (n8n)

Se quiser, **copie o JSON abaixo** e cole no canvas do n8n para ter uma estrutura base de saída.
Este workflow recebe o evento do Flux Leads, verifica se é Chat ou Follow-up, e manda para a Evolution API.

> **Importante:** Você precisará atualizar as credenciais e URL da Evolution API dentro do nó de envio.

```json
{
  "meta": {
    "instanceId": "generated_flux_leads_outbound"
  },
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "flux-leads-notification",
        "options": {}
      },
      "id": "webhook-in",
      "name": "Webhook (Flux Leads)",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [460, 360]
    },
    {
      "parameters": {
        "dataType": "string",
        "value1": "={{ $json.body.event }}",
        "rules": {
          "rules": [
            {
              "value2": "chat.new_message",
              "output": 0
            },
            {
              "value2": "deal.stage_changed",
              "output": 1
            }
          ]
        }
      },
      "id": "switch-event",
      "name": "Tipo de Evento?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 1,
      "position": [680, 360]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://SEU_EVOLUTION_API/message/sendText/INSTANCIA",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "SUA_APIKEY_AQUI"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "number",
              "value": "={{ $json.body.data.contact.phone }}"
            },
            {
              "name": "text",
              "value": "={{ $json.body.data.content }}"
            }
          ]
        },
        "options": {}
      },
      "id": "send-chat-reply",
      "name": "Enviar Resposta (Chat)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [920, 260]
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.body.data.to_stage.name }}",
              "operation": "contains",
              "value2": "Agendado"
            }
          ]
        }
      },
      "id": "filter-stage",
      "name": "Filtra Etapa 'Agendado'",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [920, 480]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://SEU_EVOLUTION_API/message/sendText/INSTANCIA",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "SUA_APIKEY_AQUI"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "number",
              "value": "={{ $json.body.data.contact.phone }}"
            },
            {
              "name": "text",
              "value": "Olá {{ $json.body.data.contact.name }}, seu pedido mudou para: {{ $json.body.data.to_stage.name }}!"
            }
          ]
        },
        "options": {}
      },
      "id": "send-followup",
      "name": "Enviar Follow-up",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1160, 480]
    }
  ],
  "connections": {
    "Webhook (Flux Leads)": {
      "main": [
        [
          {
            "node": "Tipo de Evento?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Tipo de Evento?": {
      "main": [
        [
          {
            "node": "Enviar Resposta (Chat)",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Filtra Etapa 'Agendado'",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Filtra Etapa 'Agendado'": {
      "main": [
        [
          {
            "node": "Enviar Follow-up",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```
