// Script to update the "Enviar Texto" node in Flux Leads 2 workflow
// to use correct Evolution API mention format (mentioned[] instead of mentions)
const https = require('https');
const http = require('http');

const API_URL = 'https://prospeccao-n8n-editor.gw3vnc.easypanel.host/api/v1/workflows/3LZLdfmHmP4xb8tOPcnuJ';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNzUzODk2Yi1jOWYyLTRkZmEtOTVmZi04YWYyZmE4MjFlOTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZGRlYTAzMTktNTQxNC00NDk1LWJiNWItYWY1NmU1NGQyMjJkIiwiaWF0IjoxNzcwOTA0NzkyfQ.g5kJ2TVwIU2LDpbNLmOrNkE1DXyXr9uV9PWmRDJ70sE';

const updatedEnviarTextoNode = {
    id: "5129bd3e-9917-40f0-8d21-bfcd37ef1cf3",
    name: "Enviar Texto",
    parameters: {
        method: "POST",
        url: "https://prospeccao-evolution.gw3vnc.easypanel.host/message/sendText/FluxK",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                { name: "apikey", value: "9562FEA3D88B-46F0-A771-3D6BA90F1F8E" }
            ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "number": "{{ $json.body.data.contact.phone }}",
  "text": "{{ $json.body.data.content }}",
  "mentionsEveryOne": false,
  "mentioned": {{ $json.body.data.mentions && $json.body.data.mentions.length > 0 ? JSON.stringify($json.body.data.mentions) : '[]' }},
  "quoted": {{ $json.body.data.reply_to_message_id ? JSON.stringify({ "key": { "id": $json.body.data.reply_to_message_external_id } }) : 'null' }}
}`,
        options: {}
    },
    position: [144, 48],
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.1
};

// All other nodes remain unchanged
const allNodes = [
    {
        id: "b98ecfa4-3745-4b80-a441-02cda07323d8",
        name: "Webhook (Flux Leads)",
        parameters: { httpMethod: "POST", options: {}, path: "flux-leads-notification" },
        position: [-656, 240],
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        webhookId: "9a6b0858-aafe-4e60-8bc6-a2a743f6c902"
    },
    {
        id: "c02a2e71-4a4c-431f-a39a-66ac8ea57295",
        name: "Tipo de Evento?",
        parameters: {
            dataType: "string",
            rules: { rules: [{ value2: "chat.new_message" }, { output: 1, value2: "deal.stage_changed" }] },
            value1: "={{ $json.body.event }}"
        },
        position: [-432, 208],
        type: "n8n-nodes-base.switch",
        typeVersion: 1
    },
    {
        id: "00fa692e-cd2f-4d22-a9d0-d1d404a8bbc3",
        name: "É Encaminhamento?",
        parameters: {
            conditions: { string: [{ operation: "isNotEmpty", value1: "={{ $json.body.data.forward_message_external_id }}" }] }
        },
        position: [-224, -16],
        type: "n8n-nodes-base.if",
        typeVersion: 1
    },
    {
        id: "f4826972-c12b-4173-9d92-e1070c053c74",
        name: "Encaminhar Mensagem",
        parameters: {
            bodyParameters: {
                parameters: [
                    { name: "number", value: "={{ $json.body.data.contact.phone }}" },
                    { name: "key", value: "={{ { id: $json.body.data.forward_message_external_id } }}" },
                    { name: "contextInfo", value: "={{ { isForwarded: true } }}" }
                ]
            },
            headerParameters: { parameters: [{ name: "apikey", value: "9562FEA3D88B-46F0-A771-3D6BA90F1F8E" }] },
            method: "POST", options: {}, sendBody: true, sendHeaders: true,
            url: "https://prospeccao-evolution.gw3vnc.easypanel.host/message/forwardMessage/FluxK"
        },
        position: [144, -144],
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.1
    },
    {
        id: "d9b5a1d6-26b2-4989-bb14-bac88ef7d86d",
        name: "Tipo de Mensagem?",
        parameters: {
            dataType: "string", fallbackOutput: 0,
            rules: { rules: [{ output: 1, value2: "audio" }, { output: 2, value2: "image" }, { output: 2, value2: "document" }, { output: 2, value2: "video" }] },
            value1: "={{ $json.body.data.message_type }}"
        },
        position: [-160, 208],
        type: "n8n-nodes-base.switch",
        typeVersion: 1
    },
    // *** THIS IS THE FIXED NODE ***
    updatedEnviarTextoNode,
    {
        id: "3001e23b-8a2c-4ec7-938e-94b926a36ea8",
        name: "Enviar Audio (PTT)",
        parameters: {
            bodyParameters: {
                parameters: [
                    { name: "number", value: "={{ $json.body.data.contact.phone }}" },
                    { name: "audio", value: "={{ $json.body.data.media_url }}" },
                    { name: "quoted", value: "={{ $json.body.data.reply_to_message_id ? { key: { id: $json.body.data.reply_to_message_external_id } } : undefined }}" }
                ]
            },
            headerParameters: { parameters: [{ name: "apikey", value: "9562FEA3D88B-46F0-A771-3D6BA90F1F8E" }] },
            method: "POST", options: {}, sendBody: true, sendHeaders: true,
            url: "https://prospeccao-evolution.gw3vnc.easypanel.host/message/sendWhatsAppAudio/FluxK"
        },
        position: [144, 208],
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.1
    },
    {
        id: "11756ea4-b439-4f00-aeab-c7b32b2860f4",
        name: "Enviar Mídia (Geral)",
        parameters: {
            bodyParameters: {
                parameters: [
                    { name: "number", value: "={{ $json.body.data.contact.phone }}" },
                    { name: "media", value: "={{ $json.body.data.media_url }}" },
                    { name: "mediatype", value: "={{ $json.body.data.message_type }}" },
                    { name: "caption", value: "={{ $json.body.data.content }}" },
                    { name: "quoted", value: "={{ $json.body.data.reply_to_message_id ? { key: { id: $json.body.data.reply_to_message_external_id } } : undefined }}" },
                    { name: "fileName", value: "={{ $json.body.data.fileName }}" },
                    { name: "mimetype", value: "={{ $json.body.data.mimetype }}" }
                ]
            },
            headerParameters: { parameters: [{ name: "apikey", value: "9562FEA3D88B-46F0-A771-3D6BA90F1F8E" }] },
            method: "POST", options: {}, sendBody: true, sendHeaders: true,
            url: "https://prospeccao-evolution.gw3vnc.easypanel.host/message/sendMedia/FluxK"
        },
        position: [144, 368],
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.1
    },
    {
        id: "aeeae5f1-65b5-42a5-a13f-2041526cb81c",
        name: "Filtra Etapa 'Agendado'",
        parameters: {
            conditions: { string: [{ operation: "contains", value1: "={{ $json.body.data.to_stage.name }}", value2: "Agendado" }] }
        },
        position: [-160, 512],
        type: "n8n-nodes-base.if",
        typeVersion: 1
    },
    {
        id: "a735b82f-11ee-439b-a96e-84366a117b1f",
        name: "Enviar Follow-up",
        parameters: {
            bodyParameters: {
                parameters: [
                    { name: "number", value: "={{ $json.body.data.contact.phone }}" },
                    { name: "text", value: "Olá {{ $json.body.data.contact.name }}, seu pedido mudou para: {{ $json.body.data.to_stage.name }}!" }
                ]
            },
            headerParameters: { parameters: [{ name: "apikey", value: "9562FEA3D88B-46F0-A771-3D6BA90F1F8E" }] },
            method: "POST", options: {}, sendBody: true, sendHeaders: true,
            url: "https://prospeccao-evolution.gw3vnc.easypanel.host/message/sendText/FluxK"
        },
        position: [144, 512],
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.1
    }
];

const connections = {
    "Webhook (Flux Leads)": { main: [[{ index: 0, node: "Tipo de Evento?", type: "main" }]] },
    "Tipo de Evento?": {
        main: [
            [{ index: 0, node: "É Encaminhamento?", type: "main" }],
            [{ index: 0, node: "Filtra Etapa 'Agendado'", type: "main" }]
        ]
    },
    "É Encaminhamento?": {
        main: [
            [{ index: 0, node: "Encaminhar Mensagem", type: "main" }],
            [{ index: 0, node: "Tipo de Mensagem?", type: "main" }]
        ]
    },
    "Tipo de Mensagem?": {
        main: [
            [{ index: 0, node: "Enviar Texto", type: "main" }],
            [{ index: 0, node: "Enviar Audio (PTT)", type: "main" }],
            [{ index: 0, node: "Enviar Mídia (Geral)", type: "main" }]
        ]
    },
    "Filtra Etapa 'Agendado'": { main: [[{ index: 0, node: "Enviar Follow-up", type: "main" }]] }
};

const payload = JSON.stringify({
    name: "Flux Leads 2",
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

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        if (res.statusCode === 200) {
            const result = JSON.parse(data);
            // Find the Enviar Texto node to verify
            const enviarTexto = result.nodes?.find(n => n.name === 'Enviar Texto');
            if (enviarTexto) {
                console.log('\n✅ Enviar Texto node updated successfully!');
                console.log('specifyBody:', enviarTexto.parameters?.specifyBody);
                console.log('Has jsonBody:', !!enviarTexto.parameters?.jsonBody);
                console.log('jsonBody preview:', enviarTexto.parameters?.jsonBody?.substring(0, 200));
            }
        } else {
            console.log('Response:', data.substring(0, 500));
        }
    });
});

req.on('error', (err) => console.error('Error:', err.message));
req.write(payload);
req.end();
