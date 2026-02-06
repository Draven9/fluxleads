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
Crie um workflow novo chamado "Receber WhatsApp"..
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
            },
            {
               "name": "is_group",
               "value": "={{ $json.body.data.key.remoteJid.includes('@g.us') }}"
            },
            {
               "name": "group_id",
               "value": "={{ $json.body.data.key.remoteJid }}"
            },
            {
               "name": "participant",
               "value": "={{ $json.body.data.key.participant ? $json.body.data.key.participant.split('@')[0] : '' }}"
            },
            {
               "name": "pushName",
               "value": "={{ $json.body.data.pushName }}"
            },
            {
               "name": "from_me",
               "value": "={{ $json.body.data.key.fromMe }}"
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
      "id": "webhook-flux",
      "name": "Webhook (Flux Leads)",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [
        -220,
        460
      ]
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
      "id": "switch-event-type",
      "name": "Tipo de Evento?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 1,
      "position": [
        0,
        460
      ]
    },
    {
      "parameters": {
        "dataType": "string",
        "value1": "={{ $json.body.data.message_type }}",
        "rules": {
          "rules": [
            {
              "value2": "audio",
              "output": 1
            },
            {
              "value2": "image",
              "output": 2
            },
            {
              "value2": "document",
              "output": 2
            },
            {
              "value2": "video",
              "output": 2
            }
          ]
        },
        "fallbackOutput": 0
      },
      "id": "switch-message-type",
      "name": "Tipo de Mensagem?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 1,
      "position": [
        280,
        360
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
            },
            {
              "name": "mentions",
              "value": "={{ $json.body.data.mentions }}"
            },
            {
              "name": "quoted",
              "value": "={{ $json.body.data.reply_to_message_id ? { key: { id: $json.body.data.reply_to_message_external_id } } : undefined }}"
            }
          ]
        },
        "options": {}
      },
      "id": "send-text",
      "name": "Enviar Texto",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        580,
        200
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://prospeccao-evolution.gw3vnc.easypanel.host/message/sendWhatsAppAudio/INSTANCIA",
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
              "name": "audio",
              "value": "={{ $json.body.data.media_url }}"
            }
          ]
        },
        "options": {}
      },
      "id": "send-audio",
      "name": "Enviar Audio (PTT)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        580,
        360
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://prospeccao-evolution.gw3vnc.easypanel.host/message/sendMedia/INSTANCIA",
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
              "name": "media",
              "value": "={{ $json.body.data.media_url }}"
            },
            {
              "name": "mediatype",
              "value": "={{ $json.body.data.message_type }}"
            },
            {
              "name": "caption",
              "value": "={{ $json.body.data.content }}"
            }
          ]
        },
        "options": {}
      },
      "id": "send-media",
      "name": "Enviar Mídia (Geral)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        580,
        520
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
      "id": "filter-stage",
      "name": "Filtra Etapa 'Agendado'",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        280,
        660
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
      "id": "send-followup",
      "name": "Enviar Follow-up",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        580,
        660
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
            "node": "Tipo de Mensagem?",
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
    "Tipo de Mensagem?": {
      "main": [
        [
          {
            "node": "Enviar Texto",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Enviar Audio (PTT)",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Enviar Mídia (Geral)",
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
