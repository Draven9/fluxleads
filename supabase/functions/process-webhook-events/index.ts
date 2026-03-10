import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Buscar até 50 eventos pendentes
        const { data: events, error: fetchError } = await supabase
            .from('webhook_events')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(50);

        if (fetchError) throw fetchError;
        if (!events || events.length === 0) {
            return new Response(JSON.stringify({ message: "No pending events" }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`Processing ${events.length} webhook events...`);

        // Marca como "processing"
        const eventIds = events.map(e => e.id);
        await supabase
            .from('webhook_events')
            .update({ status: 'processing', attempts: 1 })
            .in('id', eventIds);

        // 2. Processa cada evento sequencialmente (poderia ser paralelo)
        for (const eventRow of events) {
            try {
                const { provider, event_type, payload, organization_id } = eventRow;
                const objectType = payload.object;

                // Obter access token se for o caso
                let accessToken = undefined;
                if (organization_id) {
                    const { data: orgConfig } = await supabase
                        .from('organization_meta_configs')
                        .select('facebook_access_token')
                        .eq('organization_id', organization_id)
                        .maybeSingle();
                    accessToken = orgConfig?.facebook_access_token;
                }

                // Despachar pro handler correto
                if (event_type === 'messaging') {
                    const ev = payload.entry[0].messaging[0];
                    await handleMessagingEvent(supabase, ev, organization_id || 'fallback-org-id-for-dev', objectType, accessToken);
                } else if (event_type === 'change') {
                    const ch = payload.entry[0].changes[0];
                    await handleChangeEvent(supabase, ch, organization_id || 'fallback-org-id-for-dev', objectType);
                }

                // Marcar como concluído
                await supabase
                    .from('webhook_events')
                    .update({ status: 'done', processed_at: new Date().toISOString() })
                    .eq('id', eventRow.id);

            } catch (eventError) {
                console.error(`Error processing event ${eventRow.id}:`, eventError);
                await supabase
                    .from('webhook_events')
                    .update({
                        status: 'failed',
                        last_error: String(eventError),
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', eventRow.id);
            }
        }

        return new Response(JSON.stringify({ processed: events.length }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Process webhook error:', err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
});

// ============================================================================
// FUNÇÕES EXTRAÍDAS DO META-WEBHOOK (CORE PROCESSING LOGIC)
// ============================================================================

async function handleMessagingEvent(supabase: any, event: any, organizationId: string, objectType: string, accessToken?: string) {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const provider = objectType === 'instagram' ? 'instagram' : 'facebook';
    const messageText = event.message?.text || '';

    if (event.message && !event.message.is_echo) {
        console.log(`Nova mensagem de [${provider}] psid: ${senderId}: ${messageText}`);

        if (!organizationId || organizationId === 'fallback-org-id-for-dev') {
            console.warn(`[AVISO] Organização não encontrada para este PSID/IGID.`);
            return;
        }

        // 1. Procurar ou Criar Contato
        let { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('*')
            .eq('phone', senderId)
            .eq('organization_id', organizationId)
            .maybeSingle();

        if (contactError) throw contactError;

        if (!contact) {
            let contactName = `Lead via ${provider}`;

            if (accessToken) {
                try {
                    let graphUrl = `https://graph.facebook.com/v25.0/${senderId}?access_token=${accessToken}`;
                    if (provider === 'instagram') {
                        graphUrl += `&fields=name,username,profile_pic`;
                    } else {
                        graphUrl += `&fields=first_name,last_name,name,profile_pic`;
                    }

                    const profileResponse = await fetch(graphUrl);
                    const profileData = await profileResponse.json();

                    if (profileData.name) {
                        contactName = profileData.name;
                    } else if (profileData.username) {
                        contactName = profileData.username;
                    } else if (profileData.first_name) {
                        contactName = `${profileData.first_name} ${profileData.last_name || ''}`.trim();
                    }
                } catch (apiErr) {
                    console.error("Erro ao buscar perfil na Graph API:", apiErr);
                }
            }

            const { data: newContact, error: insertError } = await supabase
                .from('contacts')
                .insert({
                    name: contactName,
                    phone: senderId,
                    source: provider,
                    organization_id: organizationId
                })
                .select()
                .single();

            if (insertError) throw insertError;
            contact = newContact;
        }

        // 2. Procurar ou Criar Chat Session
        let { data: session, error: sessionError } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('contact_id', contact.id)
            .maybeSingle();

        if (sessionError) throw sessionError;

        if (!session) {
            const { data: newSession, error: newSessionError } = await supabase
                .from('chat_sessions')
                .insert({
                    contact_id: contact.id,
                    organization_id: organizationId,
                    provider: provider,
                    provider_id: recipientId
                })
                .select()
                .single();

            if (newSessionError) throw newSessionError;
            session = newSession;
        }

        // 3. Inserir a Mensagem
        const { error: messageError } = await supabase
            .from('messages')
            .insert({
                organization_id: organizationId,
                session_id: session.id,
                content: messageText,
                direction: 'inbound',
                status: 'received'
            });

        if (messageError) throw messageError;

        // 4. Atualizar Data e Unread Count da Sessão
        await supabase
            .from('chat_sessions')
            .update({
                last_message_at: new Date().toISOString(),
                unread_count: (session.unread_count || 0) + 1,
                is_marked_unread: true
            })
            .eq('id', session.id);
    }
}

async function handleChangeEvent(supabase: any, change: any, organizationId: string, objectType: string) {
    if (change.field === 'comments' || change.field === 'feed') {
        const value = change.value;
        const provider = objectType === 'instagram' ? 'instagram' : 'facebook';

        let externalCommentId, externalPostId, externalFromId, fromName, content;

        if (change.field === 'feed' && value.item === 'comment' && value.verb === 'add') {
            externalCommentId = value.comment_id;
            externalPostId = value.post_id;
            externalFromId = value.from?.id || 'unknown';
            fromName = value.from?.name || 'Usuário Facebook';
            content = value.message;
        } else if (change.field === 'comments') {
            if (!value.id || !value.text) return;
            externalCommentId = value.id;
            externalPostId = value.media?.id || value.media_id || 'unknown';
            externalFromId = value.from?.id || 'unknown';
            fromName = value.from?.username || value.from?.name || 'Usuário Instagram';
            content = value.text;
        } else {
            return;
        }

        if (organizationId && organizationId !== 'fallback-org-id-for-dev') {
            await supabase.from('social_comments').insert({
                organization_id: organizationId,
                provider: provider,
                external_comment_id: externalCommentId,
                external_post_id: externalPostId,
                external_from_id: externalFromId,
                from_name: fromName,
                content: content,
                status: 'unread'
            });
        }
    }
}
