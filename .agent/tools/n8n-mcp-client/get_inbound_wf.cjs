require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const N8N_API_URL = process.env.N8N_API_URL || "https://prospeccao-n8n-editor.gw3vnc.easypanel.host/";
const N8N_API_KEY = process.env.N8N_API_KEY;
const baseUrl = `${N8N_API_URL.replace(/\/$/, "")}/api/v1`;

async function getWorkflow() {
    try {
        const wfId = "cBe_yJDMZ0_C-DiiOF1Fj"; // Receber Whatsapp Flux Leads
        const { data: wf } = await axios.get(`${baseUrl}/workflows/${wfId}`, {
            headers: { "X-N8N-API-KEY": N8N_API_KEY }
        });
        fs.writeFileSync('receber_flux_leads.json', JSON.stringify(wf, null, 2));
        console.log("Workflow salvo em receber_flux_leads.json");
    } catch (err) {
        console.error("Erro:", err.message);
    }
}
getWorkflow();
