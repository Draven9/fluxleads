import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ─── Payload Normalizers ────────────────────────────────────────────────────

interface NormalizedMessage {
    phone: string;
    name: string;
    text: string;
    direction: 'inbound' | 'outbound';
    message_type: string;
    external_id: string | null;
    is_group: boolean;
    group_id: string | null;
    media_url: string | null;
    from_me: boolean;
}

function normalizeUazapi(body: any): NormalizedMessage | null {
    // Nova estrutura uazapi reportada: { EventType: "messages", message: { chatid, content, fromMe, senderName, type, messageid, etc } }

    // Ignora eventos que não são de mensagens, caso a webhook mande status etc.
    if (body.EventType && body.EventType !== 'messages') return null;

    // Se o webhook vier sem o object message, caímos fora também
    const msg = body.message || body;

    const fromMe = msg.fromMe === true || msg.from_me === true;

    // uazapi chatid: 553588043756@s.whatsapp.net
    const phone = (msg.sender || msg.chatid || '').replace('@s.whatsapp.net', '').replace('@g.us', '').split(':')[0];
    const isGroup = (msg.chatid || '').includes('@g.us');

    // "type": "text", "content": "Opaaa"
    const messageType = msg.type || msg.messageType || 'text';

    return {
        phone,
        name: msg.senderName || msg.pushName || body.chat?.name || phone,
        text: msg.content || msg.text || msg.caption || '',
        direction: fromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        external_id: msg.messageid || msg.messageId || msg.id || null,
        is_group: isGroup,
        group_id: isGroup ? msg.chatid : null,
        media_url: msg.fileURL || msg.mediaUrl || null,
        from_me: fromMe,
    };
}

function normalizeEvolution(body: any): NormalizedMessage | null {
    // Evolution sends: { data: { key: { remoteJid, fromMe, id }, pushName, message: { conversation } } }
    const data = body?.data;
    if (!data) return null;

    const fromMe = data.key?.fromMe === true;
    // Sem 'return null' para aceitarmos mensagens do próprio numero

    const remoteJid = data.key?.remoteJid || '';
    const isGroup = remoteJid.includes('@g.us');
    const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const text = data.message?.conversation
        || data.message?.extendedTextMessage?.text
        || data.message?.imageMessage?.caption
        || '';

    let messageType = 'text';
    if (data.message?.imageMessage) messageType = 'image';
    else if (data.message?.audioMessage) messageType = 'audio';
    else if (data.message?.videoMessage) messageType = 'video';
    else if (data.message?.documentMessage) messageType = 'document';

    return {
        phone,
        name: data.pushName || phone,
        text,
        direction: fromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        external_id: data.key?.id || null,
        is_group: isGroup,
        group_id: isGroup ? remoteJid : null,
        media_url: data.message?.imageMessage?.url || data.message?.audioMessage?.url || null,
        from_me: fromMe,
    };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const sourceId = url.searchParams.get('source');

        if (!sourceId) {
            return new Response(JSON.stringify({ error: 'Missing ?source= parameter' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Resolve the integration source
        const { data: source, error: srcErr } = await supabase
            .from('integration_inbound_sources')
            .select('*')
            .eq('id', sourceId)
            .eq('active', true)
            .single();

        if (srcErr || !source) {
            return new Response(JSON.stringify({ error: 'Invalid or inactive source' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const body = await req.json();
        const providerType: string = source.provider_type || 'uazapi';

        // Normalize by provider
        let normalized: NormalizedMessage | null = null;
        if (providerType === 'uazapi') {
            normalized = normalizeUazapi(body);
        } else if (providerType === 'evolution') {
            normalized = normalizeEvolution(body);
        }

        if (!normalized) {
            // fromMe or unrecognized — acknowledge without processing
            return new Response(JSON.stringify({ ok: true, skipped: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const orgId = source.organization_id;

        // ── 1. Upsert Contact ──────────────────────────────────────────────────
        let contactId: string | null = null;
        if (!normalized.is_group) {
            const { data: existingContact } = await supabase
                .from('contacts')
                .select('id')
                .eq('phone', normalized.phone)
                .eq('organization_id', orgId)
                .maybeSingle();

            if (existingContact) {
                contactId = existingContact.id;
            } else {
                // Upsert ignoring duplicates to safely handle race conditions
                const { data: newContact, error: contactErr } = await supabase
                    .from('contacts')
                    .upsert({
                        organization_id: orgId,
                        name: normalized.name,
                        phone: normalized.phone,
                        source: `whatsapp_${providerType}`,
                    }, { onConflict: 'organization_id,phone', ignoreDuplicates: true })
                    .select('id')
                    .maybeSingle();

                if (newContact) {
                    contactId = newContact.id;
                } else if (contactErr) {
                    console.error('[webhook] ERROR UPSERT CONTACT:', contactErr);
                }

                // If it ignored duplicate but returned no data, fetch again
                if (!contactId && !contactErr) {
                    const { data: checkAgain } = await supabase
                        .from('contacts')
                        .select('id')
                        .eq('phone', normalized.phone)
                        .eq('organization_id', orgId)
                        .maybeSingle();
                    contactId = checkAgain?.id ?? null;
                }
            }
        }

        // ── 1.5. Upsert Deal (If Source Has Default Board) ─────────────────────
        if (contactId && source.entry_board_id && source.entry_stage_id) {
            const { data: existingDeals } = await supabase
                .from('deals')
                .select('id')
                .eq('contact_id', contactId)
                .eq('board_id', source.entry_board_id)
                .eq('is_won', false)
                .eq('is_lost', false)
                .limit(1);

            if (!existingDeals || existingDeals.length === 0) {
                // To avoid multiple deals in the same second, we can't strict upsert without a unique constraint.
                // But this fallback is enough to reduce probability. 
                await supabase.from('deals').insert({
                    organization_id: orgId,
                    contact_id: contactId,
                    board_id: source.entry_board_id,
                    stage_id: source.entry_stage_id,
                    title: normalized.name || normalized.phone,
                    value: 0,
                    probability: 0,
                    priority: 'medium',
                    is_won: false,
                    is_lost: false,
                });
            }
        }

        // ── 2. Upsert Chat Session ─────────────────────────────────────────────
        let sessionId: string | null = null;
        {
            const { data: existingSession } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('organization_id', orgId)
                .eq('provider_id', normalized.is_group ? normalized.group_id : normalized.phone)
                .maybeSingle();

            if (existingSession) {
                sessionId = existingSession.id;
                await supabase
                    .from('chat_sessions')
                    .update({ updated_at: new Date().toISOString(), whatsapp_source_id: sourceId })
                    .eq('id', sessionId);
            } else {
                const { data: newSession, error: upserr } = await supabase
                    .from('chat_sessions')
                    .upsert({
                        organization_id: orgId,
                        contact_id: contactId,
                        provider: 'whatsapp',
                        provider_id: normalized.is_group ? normalized.group_id : normalized.phone,
                        whatsapp_source_id: sourceId,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'organization_id,contact_id', ignoreDuplicates: false })
                    .select('id')
                    .single();
                if (upserr) {
                    console.error('[webhook] ERROR UPSERT SESSION:', upserr);
                    return new Response(JSON.stringify({ error: upserr }), { status: 500 });
                }
                sessionId = newSession?.id ?? null;
            }
        }

        // ── 3. Insert Message ──────────────────────────────────────────────────
        if (sessionId) {
            // Dedupe by external_id
            if (normalized.external_id) {
                const { count } = await supabase
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('session_id', sessionId)
                    .eq('external_id', normalized.external_id);
                if ((count ?? 0) > 0) {
                    return new Response(JSON.stringify({ ok: true, dedupe: true }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            // If it's an outbound message (fromMe === true), try to link it to an existing CRM-originated message
            let linkedExisting = false;
            if (normalized.from_me && normalized.external_id) {
                // Find a recent outbound message without an external_id that matches the text
                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

                const { data: candidates } = await supabase
                    .from('messages')
                    .select('id')
                    .eq('session_id', sessionId)
                    .eq('direction', 'outbound')
                    .is('external_id', null)
                    .eq('content', normalized.text)
                    .gte('created_at', twoMinutesAgo)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (candidates && candidates.length > 0) {
                    await supabase.from('messages').update({
                        external_id: normalized.external_id,
                        status: 'delivered'
                    }).eq('id', candidates[0].id);
                    linkedExisting = true;
                }
            }

            if (!linkedExisting) {
                await supabase.from('messages').insert({
                    organization_id: orgId,
                    session_id: sessionId,
                    direction: normalized.direction,
                    content: normalized.text,
                    message_type: normalized.message_type,
                    media_url: normalized.media_url,
                    status: normalized.from_me ? 'sent' : 'delivered',
                    external_id: normalized.external_id,
                });
            }
        }

        // ── 4. Audit Log ───────────────────────────────────────────────────────
        const { error: auditErr } = await supabase.from('webhook_events_in').insert({
            organization_id: orgId,
            source_id: sourceId,
            provider: 'whatsapp',
            provider_type: providerType,
            external_event_id: normalized.external_id,
            payload: body,
            status: 'processed',
            created_contact_id: contactId,
        });
        if (auditErr) {
            console.error('[whatsapp-inbound] Warning: Failed to insert audit log', auditErr.message);
        }

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('[whatsapp-inbound]', err);
        return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
