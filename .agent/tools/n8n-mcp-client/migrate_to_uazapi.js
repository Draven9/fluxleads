// Script to migrate the "Receber Whatsapp Flux Leads" workflow from Evolution API to UazAPI
// Uses defensive field mapping with fallbacks to support both APIs during transition

const https = require('https');

const API_URL = 'https://prospeccao-n8n-editor.gw3vnc.easypanel.host/api/v1/workflows/cBe_yJDMZ0_C-DiiOF1Fj';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNzUzODk2Yi1jOWYyLTRkZmEtOTVmZi04YWYyZmE4MjFlOTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZGRlYTAzMTktNTQxNC00NDk1LWJiNWItYWY1NmU1NGQyMjJkIiwiaWF0IjoxNzcwOTA0NzkyfQ.g5kJ2TVwIU2LDpbNLmOrNkE1DXyXr9uV9PWmRDJ70sE';

// New webhook node - using UazAPI path
const webhookNode = {
    id: "34beeb71-c219-45e5-b814-247b181f2eb3",
    name: "Webhook (UazAPI)",
    parameters: {
        httpMethod: "POST",
        path: "webhook-uazapi-in",
        options: {}
    },
    position: [-192, 608],
    type: "n8n-nodes-base.webhook",
    typeVersion: 1,
    webhookId: "925df25e-ada0-4747-bec2-a4d7e89c0834"
};

// Updated "Enviar p/ Flux Leads" node with UazAPI field mapping + Evolution API fallbacks
const enviarNode = {
    id: "9f7c5e18-c2c5-4250-b852-05c96bb6fc7b",
    name: "Enviar p/ Flux Leads",
    parameters: {
        method: "POST",
        url: "https://coymhtpjshntpexcfzjh.supabase.co/functions/v1/webhook-in/bf52ba07-a186-43c1-b766-59a1cafa6320",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                { name: "Content-Type", value: "application/json" },
                { name: "X-Webhook-Secret", value: "hbkexKR5I4q8Kt4IsFf-OB_fc7ht5tc4" }
            ]
        },
        sendBody: true,
        bodyParameters: {
            parameters: [
                // source always whatsapp
                { name: "source", value: "whatsapp" },

                // name / pushName: UazAPI uses data.pushName (same as Evolution)
                { name: "name", value: "={{ $json.body.data.pushName || $json.body.data.senderName || '' }}" },

                // phone: UazAPI uses data.from (phone number without suffix)
                // Evolution uses data.key.remoteJid (with @s.whatsapp.net)
                { name: "phone", value: "={{ ($json.body.data.from || $json.body.data.key?.remoteJid || '').replace('@s.whatsapp.net', '').replace('@g.us', '') }}" },

                // notes / message body: UazAPI uses data.body, Evolution uses data.message.conversation
                { name: "notes", value: "={{ $json.body.data.body || $json.body.data.message?.conversation || $json.body.data.message?.extendedTextMessage?.text || $json.body.data.message?.imageMessage?.caption || '' }}" },

                // media_url: UazAPI may use data.mediaUrl or data.media.url
                { name: "media_url", value: "={{ $json.body.data.mediaUrl || $json.body.data.media?.url || $json.body.data.message?.base64 || $json.body.data.message?.imageMessage?.url || $json.body.data.message?.audioMessage?.url || $json.body.data.message?.videoMessage?.url || $json.body.data.message?.documentMessage?.url || '' }}" },

                // message_type: UazAPI uses data.messageType or data.type
                { name: "message_type", value: "={{ $json.body.data.messageType || $json.body.data.type || 'text' }}" },

                // external_event_id: UazAPI uses data.id or data.messageId, Evolution uses data.key.id
                { name: "external_event_id", value: "={{ $json.body.data.id || $json.body.data.messageId || $json.body.data.key?.id || '' }}" },

                // is_group: UazAPI may have data.isGroup boolean, or we check from field
                { name: "is_group", value: "={{ !!$json.body.data.isGroup || ($json.body.data.from || $json.body.data.key?.remoteJid || '').includes('@g.us') }}" },

                // group_id: UazAPI may use data.chatId for group JID
                { name: "group_id", value: "={{ $json.body.data.chatId || ($json.body.data.isGroup ? $json.body.data.from : '') || $json.body.data.key?.remoteJid || '' }}" },

                // participant: sender within group
                { name: "participant", value: "={{ ($json.body.data.participant || $json.body.data.key?.participant || '').split('@')[0] }}" },

                // pushName redundant field (some consumers may use this directly)
                { name: "pushName", value: "={{ $json.body.data.pushName || $json.body.data.senderName || '' }}" },

                // from_me: identifies bot-sent messages
                { name: "from_me", value: "={{ $json.body.data.fromMe || $json.body.data.key?.fromMe || false }}" }
            ]
        },
        options: {}
    },
    position: [80, 608],
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.1
};

const allNodes = [webhookNode, enviarNode];

const connections = {
    "Webhook (UazAPI)": {
        main: [[{ index: 0, node: "Enviar p/ Flux Leads", type: "main" }]]
    }
};

const payload = JSON.stringify({
    name: "Receber Whatsapp Flux Leads",
    active: true,
    settings: { executionOrder: "v1", binaryMode: "separate", availableInMCP: true },
    nodes: allNodes,
    connections
});

const url = new URL(API_URL);
const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': API_KEY,
        'Content-Length': Buffer.byteLength(payload)
    }
};

console.log('Updating workflow "Receber Whatsapp Flux Leads" for UazAPI migration...');
console.log('New webhook path: webhook-uazapi-in');
console.log('');

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        if (res.statusCode === 200) {
            const result = JSON.parse(data);

            const webhookN = result.nodes?.find(n => n.type === 'n8n-nodes-base.webhook');
            const sendN = result.nodes?.find(n => n.name === 'Enviar p/ Flux Leads');

            if (webhookN && sendN) {
                console.log('\n✅ Workflow updated successfully!');
                console.log('Webhook node name:', webhookN.name);
                console.log('Webhook path:', webhookN.parameters?.path);
                console.log('Send node params count:', sendN.parameters?.bodyParameters?.parameters?.length);

                // Show the phone mapping
                const phoneParam = sendN.parameters?.bodyParameters?.parameters?.find(p => p.name === 'phone');
                console.log('\nPhone mapping:', phoneParam?.value);

                const notesParam = sendN.parameters?.bodyParameters?.parameters?.find(p => p.name === 'notes');
                console.log('Notes mapping:', notesParam?.value);

                console.log('\n🔗 New webhook URL:');
                console.log(`  https://prospeccao-n8n-editor.gw3vnc.easypanel.host/webhook/${webhookN.parameters?.path}`);
                console.log('\nRemember to update the UazAPI instance to use the new webhook URL!');
            }
        } else {
            console.error('❌ Error updating workflow!');
            console.log('Response:', data.substring(0, 1000));
        }
    });
});

req.on('error', (err) => console.error('Error:', err.message));
req.write(payload);
req.end();
