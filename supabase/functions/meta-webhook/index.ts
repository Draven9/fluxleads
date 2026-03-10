import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);

        // 1. Validando o Webhook (GET request da Meta)
        if (req.method === 'GET') {
            const mode = url.searchParams.get('hub.mode');
            const challenge = url.searchParams.get('hub.challenge');

            if (mode === 'subscribe') {
                console.log('WEBHOOK_VERIFIED');
                return new Response(challenge, { status: 200 });
            }
            return new Response('Forbidden', { status: 403 });
        }

        // 2. Recebendo Eventos (POST request da Meta)
        if (req.method === 'POST') {
            const body = await req.json();

            // Cliente Supabase com Service Role
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            if (body.object === 'page' || body.object === 'instagram') {
                for (const entry of body.entry) {
                    const pageIdOrAccountId = entry.id;

                    // Buscar organização atrelada a essa página ou perfil
                    const { data: orgConfig } = await supabaseAdmin
                        .from('organization_meta_configs')
                        .select('organization_id')
                        .or(`facebook_page_id.eq.${pageIdOrAccountId},instagram_account_id.eq.${pageIdOrAccountId}`)
                        .eq('active', true)
                        .maybeSingle();

                    const organizationId = orgConfig?.organization_id || "fallback-org-id-for-dev";

                    // Para cada mensagem ou comentário, adicionamos à fila
                    const eventsToInsert = [];

                    // Mensagens (Direct/Messenger)
                    if (entry.messaging) {
                        for (const event of entry.messaging) {
                            // Usar o message.mid (se existir) como chave de idempotência
                            const idempotencyKey = event.message?.mid || event.delivery?.watermark || event.read?.watermark || `msg-${Date.now()}-${Math.random()}`;

                            eventsToInsert.push({
                                organization_id: organizationId === "fallback-org-id-for-dev" ? null : organizationId,
                                provider: body.object === 'instagram' ? 'instagram' : 'facebook',
                                event_type: 'messaging',
                                idempotency_key: idempotencyKey,
                                payload: { object: body.object, entry: [{ id: pageIdOrAccountId, messaging: [event] }] },
                                status: 'pending'
                            });
                        }
                    }

                    // Comentários (Feed)
                    if (entry.changes) {
                        for (const change of entry.changes) {
                            // change.value.comment_id ou id (Instagram)
                            const idempotencyKey = change.value?.comment_id || change.value?.id || `change-${Date.now()}-${Math.random()}`;

                            eventsToInsert.push({
                                organization_id: organizationId === "fallback-org-id-for-dev" ? null : organizationId,
                                provider: body.object === 'instagram' ? 'instagram' : 'facebook',
                                event_type: 'change',
                                idempotency_key: idempotencyKey,
                                payload: { object: body.object, entry: [{ id: pageIdOrAccountId, changes: [change] }] },
                                status: 'pending'
                            });
                        }
                    }

                    // Inserir na fila ignorando conflitos (idempotência)
                    if (eventsToInsert.length > 0) {
                        const { error } = await supabaseAdmin
                            .from('webhook_events')
                            .insert(eventsToInsert);

                        if (error && !error.message.includes('duplicate key value')) {
                            console.error('Falha ao inserir na fila de webhooks:', error);
                        }
                    }
                }
            }

            // A Meta exige 200 OK RÁPIDO (< 20 segundos). O processamento fica pro worker.
            return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Webhook processing error:', errorMsg);
        // Mesmo no erro, devemos tentar retornar 200 para a Meta não suspender o webhook
        return new Response(JSON.stringify({ error: errorMsg }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});


