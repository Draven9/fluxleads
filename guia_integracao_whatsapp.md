# Guia de Integração: WhatsApp ↔ Flux Leads (v2.0 — Integração Direta)

> **Novidade na v2:** O n8n foi completamente eliminado. A integração agora é **direta** entre o Flux Leads e o seu provedor de WhatsApp (uazapi ou Evolution API).

---

## Visão Geral da Arquitetura

```
┌─────────────────┐        webhook        ┌──────────────────────────────────┐
│  WhatsApp App   │ ─────────────────────▶│  Edge Function: whatsapp-inbound │
└─────────────────┘                       │  (Supabase — sem autenticação)   │
                                          └──────────────┬───────────────────┘
                                                         │
                                          ┌──────────────▼───────────────────┐
                                          │  Banco de Dados (Supabase)        │
                                          │  contacts + chat_sessions +        │
                                          │  messages                          │
                                          └──────────────────────────────────┘

┌─────────────────┐        invocar        ┌──────────────────────────────────┐
│  Flux Leads UI  │ ─────────────────────▶│  Edge Function: whatsapp-proxy   │
│  (responder)    │                       │  (autenticado, roteia por         │
└─────────────────┘                       │   provider_type)                  │
                                          └──────────────┬───────────────────┘
                                                         │
                                          ┌──────────────▼───────────────────┐
                                          │  uazapi / Evolution API           │
                                          │  (envia mensagem ao WhatsApp)     │
                                          └──────────────────────────────────┘
```

---

## Passo a Passo: Configurar uma nova instância

### 1. Adicionar instância no Flux Leads

1. Acesse **Configurações → Integrações → aba WhatsApp**
2. Clique em **"+ Adicionar número"**
3. Preencha o formulário conforme o seu provedor:

#### Se usar **uazapi**:
| Campo | Valor |
|---|---|
| Nome interno | Ex: `Comercial` |
| Nome de exibição | Ex: `Vendas WhatsApp` |
| Número | `+5511999999999` |
| Provider | `uazapi` |
| Token da instância | Copiado do painel uazapi |
| URL Base | `https://api.uazapi.com` (padrão) |

#### Se usar **Evolution API**:
| Campo | Valor |
|---|---|
| Nome interno | Ex: `Suporte` |
| Provider | `Evolution API` |
| URL da Evolution API | `https://evolution.seuservidor.com` |
| API Key | Chave do painel Evolution |
| Nome da Instância | Nome exato da instância no Evolution |

4. Clique em **"Salvar instância"**

---

### 2. Copiar a URL do Webhook

Após salvar, a instância exibirá automaticamente a URL do webhook:

```
https://<seu-projeto>.supabase.co/functions/v1/whatsapp-inbound?source=<ID_DA_INSTANCIA>
```

Clique no ícone de cópia 📋 ao lado da URL.

---

### 3. Configurar o Webhook no seu provedor

#### uazapi

1. Acesse o painel da uazapi
2. Selecione a instância correspondente
3. Vá em **Webhook** (ou Configurações da instância)
4. Cole a URL copiada no campo de webhook
5. Marque os eventos: **`messages.upsert`** (mensagens recebidas)
6. Salve

#### Evolution API

1. Acesse o painel da Evolution API
2. Selecione a instância
3. Vá em **Webhook**
4. Cole a URL copiada no campo `url`
5. Ative os eventos:
   - `MESSAGES_UPSERT` — mensagens recebidas
   - (opcional) `MESSAGES_UPDATE` — status de leitura
6. Salve

---

### 4. Testar a conexão

No Flux Leads:
1. Na lista de instâncias (Configurações → WhatsApp), clique em **↻ (atualizar)** na instância desejada
2. O badge de status mudará para 🟢 **Conectado** se a instância estiver ativa
3. Envie uma mensagem de teste de um celular para o número configurado
4. A mensagem deve aparecer em **Chat** em poucos segundos — sem n8n

---

## Fluxo de Mensagens: Como Funciona

### Mensagem recebida (inbound)

```
WhatsApp (cliente) 
  → POST para /whatsapp-inbound?source=<id>
  → valida source_id
  → normaliza payload (uazapi ou Evolution)
  → upsert em contacts (cria se não existir)
  → upsert em chat_sessions (cria se não existir, vincula ao source)
  → insere em messages (com deduplicação por external_id)
  → salva em webhook_events_in (auditoria)
  → Flux Leads exibe em tempo real via Realtime
```

### Mensagem enviada (outbound)

```
Agente clica em Enviar no Flux Leads
  → chama whatsapp-proxy (autenticado)
  → resolve a instância (sourceId ou padrão)
  → detecta provider_type (uazapi ou evolution)
  → chama API correspondente (sendText / sendMedia / sendAudio)
  → retorna confirmação
  → mensagem salva em messages com direction=outbound
```

---

## Suporte a Múltiplos Números

Cada instância cadastrada = um número diferente. O Flux Leads:

- Exibe um badge 📱 na lista de conversas identificando de qual número a mensagem veio
- Permite ter instâncias **uazapi** e **Evolution API** simultaneamente na mesma organização
- Roteia o envio automaticamente pelo número correto conforme a conversa aberta

---

## Estrutura do Payload (Referência)

### uazapi → Flux Leads
```json
{
  "instanceToken": "token_da_instancia",
  "chatid": "5511999999999@s.whatsapp.net",
  "text": "Olá, quero um orçamento",
  "sender": "5511999999999",
  "senderName": "João Silva",
  "fromMe": false,
  "messageType": "conversation",
  "messageId": "ABCDEF123456"
}
```

### Evolution API → Flux Leads
```json
{
  "event": "messages.upsert",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "ABCDEF123456"
    },
    "pushName": "João Silva",
    "message": {
      "conversation": "Olá, quero um orçamento"
    }
  }
}
```

---

## Configuração de Envio (whatsapp-proxy)

O proxy de envio usa o campo `configuration` da instância para rotear:

| provider_type | Endpoint de envio de texto |
|---|---|
| `uazapi` | `POST {baseUrl}/send/text` + header `token` |
| `evolution` | `POST {baseUrl}/message/sendText/{instanceName}` + header `apikey` |

---

## Solução de Problemas

| Problema | Causa provável | Solução |
|---|---|---|
| Mensagem não aparece no chat | Webhook não configurado ou URL errada | Confirme URL no painel do provedor |
| Badge "Desconectado" | Instância encerrou sessão | Reconecte no painel uazapi/Evolution |
| Erro "Invalid or inactive source" | source_id inválido ou instância desativada | Verifique se a instância está ativa |
| Mensagem duplicada | Webhook disparando duas vezes | A deduplicação por `external_id` previne duplicatas no DB |
| Envio falha | Token/ApiKey errado | Reconfigure as credenciais em Configurações → WhatsApp |

---

## Migração: sair do n8n

Se você ainda usa n8n, a migração é simples:

1. Configure a nova URL de webhook direto no uazapi/Evolution (Passo 3 acima)
2. Aguarde alguns minutos para confirmar que mensagens chegam direto
3. Desative os workflows do n8n (não exclua ainda, aguarde uma semana)
4. Após confirmação, encerre os workflows no n8n

> ✅ O n8n pode ser desligado com segurança após a validação.

---

*Atualizado em 2026-03-10 — Integração direta v2.0 (sem n8n)*
