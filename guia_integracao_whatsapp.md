# Guia de Integração: WhatsApp (Evolution API) <-> Flux Leads (v1.0.0)

Este guia foi separado em dois fluxos distintos para facilitar a organização e evitar erros. Recomenda-se criar **dois workflows separados** no n8n.

---

## 📥 Parte 1: Entrada (WhatsApp -> Flux Leads)

**Objetivo:** Receber mensagens dos clientes e criar Leads/Chat no sistema.

### 1. Configurar Flux Leads
1.  Acesse **Configurações > Webhooks**.
2.  Na aba **"Receber leads"**, configure o funil de entrada.
3.  Clique em **"Gerar URL e Secret"**. 
4.  Copie a **URL** e o **Secret** (você vai precisar dos dois).

### 2. Configurar n8n (Novo Workflow)
Crie um workflow novo chamado "Receber WhatsApp".
Copie o JSON abaixo e cole no n8n:

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "webhook-evolution-in",
        "options": {}
      },
      "id": "webhook-evolution-node",
      "name": "Webhook (Evolution)",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [
        460,
        460
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "SUA_URL_DO_FLUX_LEADS_AQUI",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "X-Webhook-Secret",
              "value": "SEU_SECRET_DO_FLUX_LEADS_AQUI"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "source",
              "value": "whatsapp"
            },
            {
              "name": "name",
              "value": "={{ $json.body.data.pushName }}"
            },
            {
              "name": "phone",
              "value": "={{ $json.body.data.key.remoteJid.replace('@s.whatsapp.net', '') }}"
            },
            {
              "name": "notes",
              "value": "={{ $json.body.data.message.conversation || $json.body.data.message.extendedTextMessage.text || $json.body.data.message.imageMessage?.caption || '' }}"
            },
            {
              "name": "media_url",
              "value": "={{ $json.body.data.message.base64 || $json.body.data.message.imageMessage?.url || $json.body.data.message.audioMessage?.url || $json.body.data.message.videoMessage?.url || $json.body.data.message.documentMessage?.url }}"
            },
            {
              "name": "message_type",
              "value": "={{ $json.body.data.messageType }}"
            },
            {
              "name": "external_event_id",
              "value": "={{ $json.body.data.key.id }}"
            }
          ]
        },
        "options": {}
      },
      "id": "http-request-flux",
      "name": "Enviar p/ Flux Leads",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        680,
        460
      ]
    }
  ],
  "connections": {
    "Webhook (Evolution)": {
      "main": [
        [
          {
            "node": "Enviar p/ Flux Leads",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

**Ajustes Necessários neste JSON:**
1.  Abra o nó **"Enviar p/ Flux Leads"**.
2.  Substitua `SUA_URL_DO_FLUX_LEADS_AQUI` pela URL copiada.
3.  **NOVO:** Substitua `SEU_SECRET_DO_FLUX_LEADS_AQUI` pelo Secret copiado (está nos Headers).
4.  Salve e Ative o Workflow.
5.  Configure o Webhook na Evolution API.

---

## 📤 Parte 2: Saída (Flux Leads -> WhatsApp)

**Objetivo:** Enviar respostas do chat e notificações de follow-up.

### 1. Configurar Flux Leads
1.  Acesse **Configurações > Webhooks**.
2.  Em **"Follow-up (Webhook de saída)"**, clique em conectar.
3.  Insira a URL do seu workflow de saída do n8n (veja abaixo).

### 2. Configurar n8n (Workflow de Saída)
Este é o workflow que você já tem configurado (com o Switch). Se precisar recriar, use o código abaixo.

> **Atenção:** Lembre-se de trocar `SUA_APIKEY_AQUI` e `INSTANCIA` pelos seus dados reais da Evolution para que o envio funcione.

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "flux-leads-notification",
        "options": {}
      },
      "id": "9eb83fa7-7227-4746-bf62-a24bf60af796",
      "name": "Webhook (Flux Leads)",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [
        -192,
        1280
      ],
      "webhookId": "6bf3f422-2ae0-431f-b1c2-725a616db120"
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
      "id": "d7d69b28-e393-4f0b-9d1e-222e1c5c4972",
      "name": "Tipo de Evento?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 1,
      "position": [
        48,
        1248
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://prospeccao-evolution.gw3vnc.easypanel.host/message/sendText/INSTANCIA",
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
      "id": "67b79aab-2b97-419b-bc77-140cfe1ee40f",
      "name": "Enviar Resposta (Chat)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        368,
        1104
      ]
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
      "id": "dcea6376-42a8-4594-84ca-fbb59c89c340",
      "name": "Filtra Etapa 'Agendado'",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        368,
        1264
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://prospeccao-evolution.gw3vnc.easypanel.host/message/sendText/INSTANCIA",
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
      "id": "55cc7b33-d602-4de9-96fe-c4b944fdf9ee",
      "name": "Enviar Follow-up",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        640,
        1248
      ]
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
  },
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "657917497e9ec72dc7039e3696cf9d9f29c76ebc2c1411870955d0a1d2635826"
  }
}
```
