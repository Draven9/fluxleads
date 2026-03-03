// Edge Function: send-scheduled-messages
// Invocada periodicamente (a cada 1 minuto) via pg_cron ou cron job externo.
// Busca mensagens com status 'pending' e scheduled_at <= now(),
// envia via UazAPI e atualiza o status.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface ScheduledMessageRow {
    id: string;
    organization_id: string;
    session_id: string;
    contact_id: string | null;
    content: string;
    has_variables: boolean;
    scheduled_at: string;
}

interface ContactRow {
    name: string;
    phone: string;
}

interface IntegrationRow {
    config: {
        base_url?: string;
        api_key?: string;
        instance?: string;
    };
}

function applyVariables(template: string, contact: ContactRow | null): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return template
        .replace(/\{\{nome\}\}/g, contact?.name || '')
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
                // 2. Buscar integração UazAPI da organização
                const integrationRes = await fetch(
                    `${supabaseUrl}/rest/v1/integrations?organization_id=eq.${msg.organization_id}&type=eq.uazapi&select=config&limit=1`,
                    { headers }
                );
                const integrations: IntegrationRow[] = await integrationRes.json();
                const integration = integrations[0];

                if (!integration?.config?.base_url || !integration?.config?.instance) {
                    throw new Error('Configuração UazAPI não encontrada para a organização');
                }

                // 3. Buscar sessão de chat para obter o provider_id (phone do destinatário)
                const sessionRes = await fetch(
                    `${supabaseUrl}/rest/v1/chat_sessions?id=eq.${msg.session_id}&select=provider_id&limit=1`,
                    { headers }
                );
                const sessions: { provider_id: string }[] = await sessionRes.json();
                const session = sessions[0];

                if (!session?.provider_id) {
                    throw new Error('Sessão de chat não encontrada');
                }

                // 4. Buscar contato para variáveis dinâmicas
                let contact: ContactRow | null = null;
                if (msg.contact_id) {
                    const contactRes = await fetch(
                        `${supabaseUrl}/rest/v1/contacts?id=eq.${msg.contact_id}&select=name,phone&limit=1`,
                        { headers }
                    );
                    const contacts: ContactRow[] = await contactRes.json();
                    contact = contacts[0] || null;
                }

                // 5. Substituir variáveis dinâmicas
                const finalContent = msg.has_variables
                    ? applyVariables(msg.content, contact)
                    : msg.content;

                // 6. Enviar via UazAPI
                const apiKey = integration.config.api_key || '';
                const sendRes = await fetch(
                    `${integration.config.base_url}/message/send/text/${integration.config.instance}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': apiKey,
                        },
                        body: JSON.stringify({
                            to: session.provider_id,
                            text: finalContent,
                        }),
                    }
                );

                if (!sendRes.ok) {
                    const errBody = await sendRes.text();
                    throw new Error(`UazAPI error: ${sendRes.status} - ${errBody}`);
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
