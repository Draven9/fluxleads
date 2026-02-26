require('dotenv').config();
const axios = require('axios');

const N8N_API_URL = process.env.N8N_API_URL || "https://prospeccao-n8n-editor.gw3vnc.easypanel.host/";
const N8N_API_KEY = process.env.N8N_API_KEY;
const baseUrl = `${N8N_API_URL.replace(/\/$/, "")}/api/v1`;

async function fixInboundWorkflow() {
    try {
        const wfId = "cBe_yJDMZ0_C-DiiOF1Fj"; // Receber Whatsapp Flux Leads
        console.log(`Buscando workflow ${wfId}...`);

        const { data: wf } = await axios.get(`${baseUrl}/workflows/${wfId}`, {
            headers: { "X-N8N-API-KEY": N8N_API_KEY }
        });

        console.log(`Workflow obtido: ${wf.name}`);

        for (const node of wf.nodes) {
            if (node.name === "Enviar p/ Flux Leads" && node.type === "n8n-nodes-base.httpRequest") {
                const bodyParams = node.parameters?.bodyParameters?.parameters;
                if (!bodyParams) continue;

                const setValue = (name, value) => {
                    const param = bodyParams.find(p => p.name === name);
                    if (param) param.value = value;
                };

                // Atualizando mapeamentos baseados no payload do UazAPI (data.* ou chat.wa_*)
                // Como UazAPI pode mandar both events messages.upsert/chats, cobrimos ambos de forma defensiva
                setValue("name", "={{ $json.body.data?.pushName || $json.body.chat?.wa_name || $json.body.chat?.name || $json.body.chat?.wa_contactName || '' }}");
                setValue("phone", "={{ ($json.body.data?.from || $json.body.chat?.wa_chatid || $json.body.data?.key?.remoteJid || '').replace('@s.whatsapp.net', '').replace('@g.us', '') }}");
                setValue("notes", "={{ $json.body.data?.body || $json.body.chat?.wa_lastMessageTextVote || '' }}");
                setValue("media_url", "={{ $json.body.data?.mediaUrl || $json.body.chat?.media_url || '' }}");
                setValue("message_type", "={{ $json.body.data?.messageType || $json.body.chat?.wa_lastMessageType || 'text' }}");
                setValue("external_event_id", "={{ $json.body.data?.id || $json.body.chat?.wa_lastMsgTimestamp?.toString() || '' }}");
                setValue("is_group", "={{ !!$json.body.data?.isGroup || !!$json.body.chat?.wa_isGroup || ($json.body.chat?.wa_chatid || '').includes('@g.us') }}");
                setValue("group_id", "={{ $json.body.data?.chatId || ($json.body.chat?.wa_isGroup ? $json.body.chat?.wa_chatid : '') || '' }}");
                setValue("participant", "={{ ($json.body.data?.participant || $json.body.chat?.wa_lastMessageSender || '').split('@')[0] }}");
                setValue("pushName", "={{ $json.body.data?.pushName || $json.body.chat?.wa_name || $json.body.chat?.name || '' }}");
                setValue("from_me", "={{ $json.body.data?.fromMe || ($json.body.chat?.wa_lastMessageSender && $json.body.owner && $json.body.chat.wa_lastMessageSender.includes($json.body.owner)) || false }}");

                console.log("Campos de Enviar p/ Flux Leads atualizados!");
            }
        }

        console.log(`Salvando workflow atualizado...`);
        const putPayload = {
            name: wf.name,
            settings: { executionOrder: wf.settings?.executionOrder || 'v1' },
            nodes: wf.nodes,
            connections: wf.connections
        };

        await axios.put(`${baseUrl}/workflows/${wfId}`, putPayload, {
            headers: { "X-N8N-API-KEY": N8N_API_KEY }
        });

        console.log(`Workflow salvo com sucesso!`);

    } catch (err) {
        console.error("Erro:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    }
}

fixInboundWorkflow();
