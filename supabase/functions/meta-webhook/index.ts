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

            // TEMPORARY DEBUG LOG FOR FACEBOOK COMMENTS FORMAT
            console.log('RAW WEBHOOK PAYLOAD:', JSON.stringify(body, null, 2));

            // Cliente Supabase com Service Role para ignorar RLS e inserir no back-end
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            if (body.object === 'page' || body.object === 'instagram') {
                for (const entry of body.entry) {
                    const pageIdOrAccountId = entry.id; // PSID/IG ID que engatilhou

                    // Buscar organização atrelada a essa página ou perfil
                    const { data: orgConfig } = await supabaseAdmin
                        .from('organization_meta_configs')
                        .select('organization_id, facebook_access_token')
                        .or(`facebook_page_id.eq.${pageIdOrAccountId},instagram_account_id.eq.${pageIdOrAccountId}`)
                        .eq('active', true)
                        .maybeSingle();

                    // Se não tiver org correspondente, cai no fallback pra não perder a mensagem no teste
                    const organizationId = orgConfig?.organization_id || "fallback-org-id-for-dev";
                    const accessToken = orgConfig?.facebook_access_token;

                    // Mensagens (Direct/Messenger)
                    if (entry.messaging) {
                        for (const event of entry.messaging) {
                            await handleMessagingEvent(supabaseAdmin, event, organizationId, body.object, accessToken);
                        }
                    }

                    // Comentários (Feed)
                    if (entry.changes) {
                        for (const change of entry.changes) {
                            await handleChangeEvent(supabaseAdmin, change, organizationId, body.object);
                        }
                    }
                }
            }

            // Meta exige 200 OK rápido
            return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Webhook processing error:', errorMsg);
        return new Response(JSON.stringify({ error: errorMsg }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});

async function handleMessagingEvent(supabase: any, event: any, organizationId: string, objectType: string, accessToken?: string) {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const provider = objectType === 'instagram' ? 'instagram' : 'facebook';
    const messageText = event.message?.text || '';

    if (event.message && !event.message.is_echo) {
        console.log(`Nova mensagem de [${provider}] psid: ${senderId}: ${messageText}`);

        if (!organizationId || organizationId === 'fallback-org-id-for-dev') {
            console.warn(`[AVISO] Organização não encontrada para este PSID/IGID. Configure 'organization_meta_configs' no banco de dados. Mensagem recebida, mas não salva no banco.`);
            return;
        }

        try {
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

                // Tentar buscar o nome real na Graph API se tivermos o token
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
                // CORREÇÃO CRÍTICA AQUI: A tabela chat_sessions não aceita o campo 'status' atualmente.
                // Inserir com provider e sem o status para não causar erro 500 no Supabase.
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
            const { data: newMessage, error: messageError } = await supabase
                .from('messages')
                .insert({
                    organization_id: organizationId,
                    session_id: session.id,
                    content: messageText,
                    direction: 'inbound',
                    status: 'received'
                })
                .select()
                .single();

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

            console.log("Mensagem salva na tabela messages com sucesso!");

        } catch (dbError) {
            console.error("Erro inserindo no banco de dados:", dbError);
        }
    }
}

async function handleChangeEvent(supabase: any, change: any, organizationId: string, objectType: string) {
    if (change.field === 'comments' || change.field === 'feed') {
        const value = change.value;
        const provider = objectType === 'instagram' ? 'instagram' : 'facebook';

        let externalCommentId, externalPostId, externalFromId, fromName, content;

        if (change.field === 'feed' && value.item === 'comment' && value.verb === 'add') {
            // Facebook Pages comment structure
            externalCommentId = value.comment_id;
            externalPostId = value.post_id;
            externalFromId = value.from?.id || 'unknown';
            fromName = value.from?.name || 'Usuário Facebook';
            content = value.message;
        } else if (change.field === 'comments') {
            // Instagram comment structure
            // Para instagram, muitas vezes vem delete ou hide no text, checar se não é verb diferente
            // se tiver apenas 'id' e 'text' já é um comentário criado.
            if (!value.id || !value.text) return; // ignora se não for criação de comment válido
            externalCommentId = value.id;
            externalPostId = value.media?.id || value.media_id || 'unknown';
            externalFromId = value.from?.id || 'unknown';
            fromName = value.from?.username || value.from?.name || 'Usuário Instagram';
            content = value.text;
        } else {
            return; // Outro tipo de evento feed/comments (edição, curtir, etc)
        }

        console.log(`Novo comentário de ${fromName}: ${content}`);

        if (organizationId && organizationId !== 'fallback-org-id-for-dev') {
            const { error } = await supabase.from('social_comments').insert({
                organization_id: organizationId,
                provider: provider,
                external_comment_id: externalCommentId,
                external_post_id: externalPostId,
                external_from_id: externalFromId,
                from_name: fromName,
                content: content,
                status: 'unread'
            });

            if (error) {
                console.error("Falha inserindo comment:", error);
            } else {
                console.log("Comentário salvo em social_comments com sucesso!");
            }
        }
    }
}
