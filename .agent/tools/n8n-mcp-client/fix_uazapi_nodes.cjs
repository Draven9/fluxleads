require('dotenv').config();
const axios = require('axios');

const N8N_API_URL = process.env.N8N_API_URL || "https://prospeccao-n8n-editor.gw3vnc.easypanel.host/";
const N8N_API_KEY = process.env.N8N_API_KEY;
const baseUrl = `${N8N_API_URL.replace(/\/$/, "")}/api/v1`;

async function fixWorkflow() {
    try {
        const wfId = "3LZLdfmHmP4xb8tOPcnuJ";
        console.log(`Buscando workflow ${wfId}...`);
        const { data: wf } = await axios.get(`${baseUrl}/workflows/${wfId}`, {
            headers: { "X-N8N-API-KEY": N8N_API_KEY }
        });

        console.log(`Workflow obtido: ${wf.name}`);

        for (const node of wf.nodes) {
            if (node.type === "n8n-nodes-base.httpRequest") {
                const bodyParams = node.parameters?.bodyParameters?.parameters;
                if (!bodyParams) continue;

                let isUazapi = node.parameters.url && node.parameters.url.includes("uazapi.com");

                if (isUazapi) {
                    console.log(`Fixing node: ${node.name}`);

                    // 1. Fix Mentions (Array -> String)
                    const mentionsIndex = bodyParams.findIndex(p => p.name === "mentions");
                    if (mentionsIndex !== -1) {
                        bodyParams[mentionsIndex].value = "={{ $json.body.data.mentions && $json.body.data.mentions.length > 0 ? $json.body.data.mentions.join(',') : undefined }}";
                    }

                    // 2. Fix Quoted -> replyid
                    const quotedIndex = bodyParams.findIndex(p => p.name === "quoted");
                    if (quotedIndex !== -1) {
                        bodyParams[quotedIndex].name = "replyid";
                        bodyParams[quotedIndex].value = "={{ $json.body.data.reply_to_message_id ? $json.body.data.reply_to_message_external_id : undefined }}";
                    }

                    // 3. Fix Enviar Audio (PTT)
                    if (node.name === "Enviar Audio (PTT)") {
                        node.parameters.url = "https://fluxcomunicacao.uazapi.com/send/media";

                        const audioIndex = bodyParams.findIndex(p => p.name === "audio");
                        if (audioIndex !== -1) {
                            bodyParams[audioIndex].name = "file";
                        }

                        if (!bodyParams.find(p => p.name === "type")) {
                            bodyParams.push({ name: "type", value: "ptt" });
                        }
                    }

                    // 4. Fix Enviar Mídia (Geral)
                    if (node.name === "Enviar Mídia (Geral)") {
                        node.parameters.url = "https://fluxcomunicacao.uazapi.com/send/media";

                        const mediaIndex = bodyParams.findIndex(p => p.name === "media");
                        if (mediaIndex !== -1) {
                            bodyParams[mediaIndex].name = "file";
                        }

                        const mediatypeIndex = bodyParams.findIndex(p => p.name === "mediatype");
                        if (mediatypeIndex !== -1) {
                            bodyParams[mediatypeIndex].name = "type";
                        }
                    }

                    // 5. Ensure Enviar Texto and Follow-up are /send/text
                    if (node.name === "Enviar Texto" || node.name === "Enviar Follow-up" || node.name === "Encaminhar Mensagem") {
                        node.parameters.url = "https://fluxcomunicacao.uazapi.com/send/text";
                    }
                }
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

fixWorkflow();
