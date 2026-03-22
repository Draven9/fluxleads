// Edge Function: send-scheduled-messages
// Invocada periodicamente (a cada 1 minuto) via pg_cron ou cron job externo.
// Busca mensagens com status 'pending' e scheduled_at <= now(),
// envia via UazAPI e atualiza o status.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface ScheduledMessageRow {
    id: string;
    organization_id: string;
    session_id: string | null;
    contact_id: string | null;
    content: string;
    has_variables: boolean;
    scheduled_at: string;
}

interface ContactRow {
    name: string;
    phone: string;
    company_name?: string | null;
}

interface IntegrationSourceRow {
    provider_type: string;
    configuration: {
        baseUrl?: string;
        token?: string;       // uazapi
        apiKey?: string;      // evolution
        instanceName?: string; // evolution
    };
}

function applyVariables(template: string, contact: ContactRow | null): string {
    const now = new Date();
    const tz = 'America/Sao_Paulo';
    const dateStr = now.toLocaleDateString('pt-BR', { timeZone: tz });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz });

    return template
        .replace(/\{\{nome\}\}/g, contact?.name || '')
        .replace(/\{\{empresa\}\}/g, contact?.company_name || '')
        .replace(/\{\{data\}\}/g, dateStr)
        .replace(/\{\{hora\}\}/g, timeStr);
}

Deno.serve(async (_req: Request) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
    };

    // 1. Buscar mensagens pendentes com scheduled_at <= now()
    const pendingRes = await fetch(
        `${supabaseUrl}/rest/v1/scheduled_messages?status=eq.pending&scheduled_at=lte.${new Date().toISOString()}&select=*`,
        { headers }
    );

    const pendingMessages: ScheduledMessageRow[] = await pendingRes.json();

    if (!pendingMessages.length) {
        return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    const results = await Promise.allSettled(
        pendingMessages.map(async (msg) => {
            try {
                // 2. Buscar integração WhatsApp da organização (uazapi ou evolution)
                const integrationRes = await fetch(
                    `${supabaseUrl}/rest/v1/integration_inbound_sources?organization_id=eq.${msg.organization_id}&active=eq.true&select=provider_type,configuration&limit=1`,
                    { headers }
                );
                const integrations: IntegrationSourceRow[] = await integrationRes.json();
                const integration = integrations[0];

                if (!integration?.configuration?.baseUrl) {
                    throw new Error('Configuração WhatsApp não encontrada para a organização');
                }

                // 3. Obter o provider_id (phone do destinatário) — via sessão ou contato direto
                let recipientPhone: string;

                if (msg.session_id) {
                    const sessionRes = await fetch(
                        `${supabaseUrl}/rest/v1/chat_sessions?id=eq.${msg.session_id}&select=provider_id,contact_id&limit=1`,
                        { headers }
                    );
                    const sessions: { provider_id: string; contact_id: string | null }[] = await sessionRes.json();
                    const session = sessions[0];
                    if (!session?.provider_id) {
                        throw new Error('Sessão de chat não encontrada');
                    }
                    recipientPhone = session.provider_id;
                    // Usar contact_id da sessão se não veio no agendamento
                    if (!msg.contact_id && session.contact_id) {
                        msg.contact_id = session.contact_id;
                    }
                } else if (msg.contact_id) {
                    // Sem sessão: usar phone do contato diretamente
                    const contactPhoneRes = await fetch(
                        `${supabaseUrl}/rest/v1/contacts?id=eq.${msg.contact_id}&select=phone&limit=1`,
                        { headers }
                    );
                    const phoneRows: { phone: string }[] = await contactPhoneRes.json();
                    if (!phoneRows[0]?.phone) {
                        throw new Error('Contato sem número de telefone cadastrado');
                    }
                    recipientPhone = phoneRows[0].phone;
                } else {
                    throw new Error('Agendamento sem sessão nem contato associado');
                }

                // 4. Buscar contato para variáveis dinâmicas
                let contact: ContactRow | null = null;
                if (msg.contact_id) {
                    const contactRes = await fetch(
                        `${supabaseUrl}/rest/v1/contacts?id=eq.${msg.contact_id}&select=name,phone,company_name&limit=1`,
                        { headers }
                    );
                    const contacts: ContactRow[] = await contactRes.json();
                    contact = contacts[0] || null;
                }

                // 5. Substituir variáveis dinâmicas
                const finalContent = msg.has_variables
                    ? applyVariables(msg.content, contact)
                    : msg.content;

                // 6. Enviar via WhatsApp (uazapi ou evolution)
                const cfg = integration.configuration;
                const baseUrl = cfg.baseUrl!.replace(/\/$/, '');
                const providerType = integration.provider_type || 'uazapi';

                let sendUrl: string;
                let sendHeaders: Record<string, string>;
                let sendBody: string;

                if (providerType === 'evolution') {
                    if (!cfg.instanceName || !cfg.apiKey) {
                        throw new Error('Configuração Evolution incompleta (instanceName/apiKey ausente)');
                    }
                    sendUrl = `${baseUrl}/message/sendText/${cfg.instanceName}`;
                    sendHeaders = { 'Content-Type': 'application/json', 'apikey': cfg.apiKey };
                    sendBody = JSON.stringify({ number: recipientPhone, text: finalContent });
                } else {
                    // uazapi
                    sendUrl = `${baseUrl}/message/send/text`;
                    sendHeaders = { 'Content-Type': 'application/json', 'Authorization': cfg.token || '' };
                    sendBody = JSON.stringify({ to: recipientPhone, text: finalContent });
                }

                const sendRes = await fetch(sendUrl, {
                    method: 'POST',
                    headers: sendHeaders,
                    body: sendBody,
                });

                if (!sendRes.ok) {
                    const errBody = await sendRes.text();
                    throw new Error(`WhatsApp API error [${providerType}]: ${sendRes.status} - ${errBody}`);
                }

                // 7. Marcar como enviada
                await fetch(
                    `${supabaseUrl}/rest/v1/scheduled_messages?id=eq.${msg.id}`,
                    {
                        method: 'PATCH',
                        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
                        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
                    }
                );

                return { id: msg.id, status: 'sent' };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);

                // Marcar como falhou
                await fetch(
                    `${supabaseUrl}/rest/v1/scheduled_messages?id=eq.${msg.id}`,
                    {
                        method: 'PATCH',
                        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
                        body: JSON.stringify({ status: 'failed', error_message: errorMessage }),
                    }
                );

                return { id: msg.id, status: 'failed', error: errorMessage };
            }
        })
    );

    const summary = results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason }));

    return new Response(JSON.stringify({ processed: pendingMessages.length, results: summary }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
});
