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
    *   *Dica: Você pode usar o mesmo workflow no n8n e usar um nó "Switch" para diferenciar o tipo de evento, ou criar workflows separados com URLs diferentes e ir mudando conforme a necessidade. Recomendo um workflow único que filtre pelo campo `event`.*

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

### ⚡ Configuração no n8n (Send Text)
1.  Receba o webhook.
2.  Use um **Switch** ou **If** para verificar se `event` == `chat.new_message`.
3.  Se sim, conecte ao nó **Evolution API (Send Text)**.
    *   **Remote Jid:** `{{ $json.body.data.contact.phone }}`
    *   **Text:** `{{ $json.body.data.content }}`

---

## 🚀 Parte 4: Fluxo de Follow-up (Mudança de Etapa)

Quando você arrasta um card no Kanban para outra etapa, o sistema envia este evento (útil para mensagens automáticas tipo "Seu pedido foi aprovado!"):

**JSON Enviado:**
```json
{
  "event": "deal.stage_changed",
  "data": {
    "deal_id": "uuid...",
    "title": "Negócio Honda Civic",
    "contact": {
      "name": "João da Silva",
      "phone": "551199999999",
      "email": "joao@email.com"
    },
    "from_stage": { "id": "...", "name": "Novos" },
    "to_stage": { "id": "...", "name": "Qualificados" }
  }
}
```

### ⚡ Configuração no n8n (Automação)
1.  Receba o webhook (pode ser o mesmo URL do chat).
2.  Verifique se `event` == `deal.stage_changed`.
3.  Verifique a etapa (`data.to_stage.name` == "Agendados").
4.  Se sim, conecte ao nó **Evolution API (Send Text)**.
    *   **Text:** "Olá {{ $json.body.data.contact.name }}, vi que seu negócio mudou para Agendado!"

Pronto! Seu CRM agora conversa nas duas direções. 🔄
