'use server';

import { Contact, ContactCustomField } from '@/types';

interface WebhookPayload {
    contactId: string;
    fieldId: string;
    value: string | null;
    triggerUrl: string;
    fieldName: string;
}

/**
 * Server Action para disparar webhooks do N8n em background.
 * Executa do lado do servidor (node/edge) contornando CORS e escondendo o fluxo do N8n do frontend.
 */
export async function triggerN8nWebhook(payload: WebhookPayload) {
    try {
        const { contactId, fieldId, value, triggerUrl, fieldName } = payload;

        if (!triggerUrl) {
            console.log('Sem URL de trigger para o campo', fieldName);
            return { success: false, reason: 'No trigger URL provided' };
        }

        // Criando um payload padronizado para o N8n ingerir Facilmente
        const n8nData = {
            event: 'fluxleads_custom_field_updated',
            timestamp: new Date().toISOString(),
            data: {
                contact_id: contactId,
                field: {
                    id: fieldId,
                    name: fieldName,
                    value: value
                }
            }
        };

        console.log(`Disparando webhook N8n para: ${triggerUrl}`, n8nData);

        const response = await fetch(triggerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(n8nData),
            // Não espera indefinidamente se o N8n estiver fora do ar
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            console.error(`Falha ao disparar webhook para ${triggerUrl}: Status ${response.status}`);
            return { success: false, status: response.status };
        }

        const responseText = await response.text();
        console.log(`Webhook disparado com sucesso (${response.status}):`, responseText);

        return { success: true, status: response.status };

    } catch (error) {
        console.error('Erro ao conectar com webhook N8n:', error);
        return { success: false, reason: (error as Error).message };
    }
}
