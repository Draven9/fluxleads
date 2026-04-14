import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ─── Payload Normalizers ──────────────────────────────────────────────────────

interface NormalizedMessage {
    phone: string;
    name: string;
    text: string;
    direction: 'inbound' | 'outbound';
    message_type: string;
    external_id: string | null;
    is_group: boolean;
    group_id: string | null;
    group_name: string | null;
    media_url: string | null;
    media_mime_type: string | null;
    from_me: boolean;
    sender_phone: string | null;
    sender_name: string | null;
    // Evolution-specific for media download
    evolution_base_url?: string | null;
    evolution_api_key?: string | null;
    evolution_instance_name?: string | null;
    evolution_message_key?: any;
}

function normalizeUazapi(body: any): NormalizedMessage | null {
    if (body.EventType && body.EventType !== 'messages') return null;

    const msg = body.message || body;
    const fromMe = msg.fromMe === true || msg.from_me === true;
    const isGroup = (msg.chatid || '').includes('@g.us');

    const senderJid = isGroup ? (msg.sender || '') : '';
    const senderPhone = isGroup
        ? senderJid.replace('@s.whatsapp.net', '').replace('@g.us', '') || null
        : null;
    const senderName = isGroup ? (msg.senderName || msg.pushName || null) : null;

    const groupName = isGroup ? (body.chat?.name || body.groupName || null) : null;

    // Para fromMe=true (eco de mensagem enviada), o interlocutor está em chatid, não em sender.
    // sender é o JID do próprio usuário quando fromMe=true.
    const phone = isGroup
        ? (msg.chatid || '').replace('@g.us', '')
        : fromMe
            ? (msg.chatid || '').replace('@s.whatsapp.net', '').split(':')[0]
            : (msg.sender || msg.chatid || '').replace('@s.whatsapp.net', '').split(':')[0];

    const messageType = msg.type || msg.messageType || 'text';

    return {
        phone,
        name: isGroup
            ? (groupName || phone)
            : fromMe
                ? (body.chat?.name || phone)
                : (msg.senderName || msg.pushName || body.chat?.name || phone),
        text: msg.content || msg.text || msg.caption || '',
        direction: fromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        external_id: msg.messageid || msg.messageId || msg.id || null,
        is_group: isGroup,
        group_id: isGroup ? msg.chatid : null,
        group_name: groupName,
        media_url: msg.fileURL || msg.mediaUrl || null,
        media_mime_type: null,
        from_me: fromMe,
        sender_phone: senderPhone,
        sender_name: senderName,
    };
}

function normalizeEvolution(body: any, source: any): NormalizedMessage | null {
    const data = body?.data;
    if (!data) return null;

    const fromMe = data.key?.fromMe === true;
    const remoteJid = data.key?.remoteJid || '';
    const isGroup = remoteJid.includes('@g.us');
    const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

    const participantJid = data.participant || '';
    const senderPhone = isGroup
        ? participantJid.replace('@s.whatsapp.net', '').replace('@g.us', '') || null
        : null;
    const senderName = isGroup ? (data.pushName || null) : null;

    const groupName = isGroup
        ? (body.data?.groupMetadata?.subject || body.groupName || data.groupName || null)
        : null;

    const text = data.message?.conversation
        || data.message?.extendedTextMessage?.text
        || data.message?.imageMessage?.caption
        || data.message?.videoMessage?.caption
        || data.message?.documentMessage?.caption
        || '';

    let messageType = 'text';
    let mediaMimeType: string | null = null;
    let mediaUrl: string | null = null;

    if (data.message?.imageMessage) {
        messageType = 'image';
        mediaMimeType = data.message.imageMessage.mimetype || 'image/jpeg';
        mediaUrl = data.message.imageMessage.url || null;
    } else if (data.message?.audioMessage) {
        messageType = 'audio';
        mediaMimeType = data.message.audioMessage.mimetype || 'audio/ogg';
        mediaUrl = data.message.audioMessage.url || null;
    } else if (data.message?.videoMessage) {
        messageType = 'video';
        mediaMimeType = data.message.videoMessage.mimetype || 'video/mp4';
        mediaUrl = data.message.videoMessage.url || null;
    } else if (data.message?.documentMessage) {
        messageType = 'document';
        mediaMimeType = data.message.documentMessage.mimetype || 'application/octet-stream';
        mediaUrl = data.message.documentMessage.url || null;
    }

    const cfg = source?.configuration || {};

    let leadName = isGroup ? (groupName || phone) : (data.pushName || phone);

    if (leadName) {
        // Normalizar caracteres (NFKD) para pegar variações como espaços especiais ou acentos invisíveis
        leadName = leadName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim();

        // Filtro agressivo para nomes genéricos ou da própria empresa
        const genericPatterns = /flux|comunic|leads|evolution|api|atendimento|suporte|desk|lead|unknown|desconhecido/i;
        
        if (genericPatterns.test(leadName) || leadName.length < 2) {
            console.log(`[whatsapp-inbound] Nome descartado por ser genérico: "${leadName}".`);
            leadName = null; // Força o uso do telefone nos fallbacks
        }
    }

    return {
        phone,
        name: leadName || phone, // Fallback para o telefone se o nome for nulo ou genérico
        text,
        direction: fromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        external_id: data.key?.id || null,
        is_group: isGroup,
        group_id: isGroup ? remoteJid : null,
        group_name: groupName,
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
        from_me: fromMe,
        sender_phone: senderPhone,
        sender_name: senderName,
        evolution_base_url: cfg.baseUrl || null,
        evolution_api_key: cfg.apiKey || null,
        evolution_instance_name: cfg.instanceName || null,
        evolution_message_key: data.key || null,
    };
}

// ─── Fetch Group Name from Evolution API ─────────────────────────────────────

async function fetchGroupNameFromEvolution(groupJid: string, source: any): Promise<string | null> {
    try {
        const config = source?.configuration || {};
        const baseUrl = (config.baseUrl || config.apiUrl || '').replace(/\/$/, '');
        const apiKey = config.apiKey;
        const instanceName = config.instanceName;
        if (!baseUrl || !apiKey || !instanceName) return null;

        const headers: Record<string, string> = { 'apikey': apiKey, 'Content-Type': 'application/json' };
        const res = await fetch(`${baseUrl}/group/findGroupInfos/${instanceName}?groupJid=${groupJid}`, { headers });
        if (!res.ok) return null;

        const info = await res.json();
        const g = Array.isArray(info) ? info[0] : info;
        return g?.subject || null;
    } catch {
        return null;
    }
}

// ─── Media Download & Upload ──────────────────────────────────────────────────

async function downloadAndUploadMedia(normalized: NormalizedMessage): Promise<string | null> {
    if (!normalized.media_url && !normalized.evolution_message_key) return null;

    try {
        let fileBytes: Uint8Array | null = null;
        let mimeType = normalized.media_mime_type || 'application/octet-stream';

        // Try Evolution API base64 endpoint first (most reliable)
        if (normalized.evolution_base_url && normalized.evolution_api_key && normalized.evolution_instance_name && normalized.evolution_message_key) {
            const base = normalized.evolution_base_url.replace(/\/$/, '');
            const instance = normalized.evolution_instance_name;
            const apiKey = normalized.evolution_api_key;

            const resp = await fetch(
                `${base}/chat/getBase64FromMediaMessage/${instance}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                    body: JSON.stringify({ message: { key: normalized.evolution_message_key }, convertToMp4: false }),
                }
            );

            if (resp.ok) {
                const json = await resp.json();
                if (json.base64) {
                    mimeType = json.mimetype || mimeType;
                    const b64 = json.base64.replace(/^data:[^;]+;base64,/, '');
                    const binaryStr = atob(b64);
                    fileBytes = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) {
                        fileBytes[i] = binaryStr.charCodeAt(i);
                    }
                }
            } else {
                console.warn('[media] Evolution base64 endpoint failed:', resp.status, await resp.text());
            }
        }

        // Fallback: download directly from the media_url
        if (!fileBytes && normalized.media_url) {
            const resp = await fetch(normalized.media_url);
            if (!resp.ok) {
                console.warn('[media] Direct URL download failed:', resp.status);
                return normalized.media_url;
            }
            const buffer = await resp.arrayBuffer();
            fileBytes = new Uint8Array(buffer);
            mimeType = resp.headers.get('content-type') || mimeType;
        }

        if (!fileBytes) return normalized.media_url;

        const extMap: Record<string, string> = {
            'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
            'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/webm': 'webm',
            'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv',
            'application/pdf': 'pdf',
        };
        const ext = extMap[mimeType] || 'bin';
        const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const storagePath = `whatsapp/${filename}`;

        const { error: uploadErr } = await supabase.storage
            .from('chat-media')
            .upload(storagePath, fileBytes, { contentType: mimeType, upsert: false });

        if (uploadErr) {
            console.error('[media] Upload error:', uploadErr);
            return normalized.media_url;
        }

        const { data: publicData } = supabase.storage
            .from('chat-media')
            .getPublicUrl(storagePath);

        return publicData?.publicUrl || normalized.media_url;
    } catch (err) {
        console.error('[media] downloadAndUploadMedia error:', err);
        return normalized.media_url;
    }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

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
        const orgId = source.organization_id;

        // ── GROUPS_UPSERT: create/update group sessions automatically ─────────
        // Evolution fires this event when the instance connects and whenever
        // a group is created or updated. Handle it here so groups appear in
        // the session list without any manual import button.
        if (body.event === 'groups.upsert' && Array.isArray(body.data)) {
            const groups: any[] = body.data;
            let created = 0;

            for (const group of groups) {
                const groupJid: string = group.id || '';
                if (!groupJid.includes('@g.us')) continue;

                const groupName: string = group.subject || groupJid.split('@')[0];

                // Upsert contact (group treated as a contact)
                const { data: contact } = await supabase
                    .from('contacts')
                    .upsert({
                        organization_id: orgId,
                        phone: groupJid,
                        name: groupName,
                        source: 'whatsapp_group',
                    }, { onConflict: 'organization_id,phone' })
                    .select('id')
                    .maybeSingle();

                if (contact?.id) {
                    // Upsert session for this group
                    await supabase
                        .from('chat_sessions')
                        .upsert({
                            organization_id: orgId,
                            contact_id: contact.id,
                            provider: 'whatsapp',
                            provider_id: groupJid,
                            name: groupName,
                            whatsapp_source_id: sourceId,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'organization_id,provider_id', ignoreDuplicates: false });
                    created++;
                }
            }

            console.log(`[whatsapp-inbound] groups.upsert: processed ${groups.length} groups, created/updated ${created} sessions`);
            return new Response(JSON.stringify({ ok: true, groups: created }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── CONTACTS_UPSERT: update contact names when they change ────────────
        // Evolution fires this with pushName updates. Only update if the
        // contact exists and doesn't already have a real name set.
        if (body.event === 'contacts.upsert' && Array.isArray(body.data)) {
            for (const c of body.data) {
                const jid: string = c.id || '';
                const pushName: string = c.pushName || c.name || '';
                if (!jid || !pushName) continue;

                // Normalize JID to phone (strip suffix)
                const phone = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');

                // Only update if name is empty/null — never overwrite a set name
                await supabase
                    .from('contacts')
                    .update({ name: pushName })
                    .eq('organization_id', orgId)
                    .eq('phone', phone)
                    .or('name.is.null,name.eq.' + phone); // only if name is null or equals the phone number fallback
            }

            return new Response(JSON.stringify({ ok: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let normalized: NormalizedMessage | null = null;
        if (providerType === 'uazapi') {
            normalized = normalizeUazapi(body);
        } else if (providerType === 'evolution') {
            normalized = normalizeEvolution(body, source);
        }

        if (!normalized) {
            await supabase.from('webhook_events_in').insert({
                organization_id: source.organization_id,
                source_id: sourceId,
                provider: 'whatsapp',
                provider_type: providerType,
                payload: body,
                status: 'skipped'
            });

            return new Response(JSON.stringify({ ok: true, skipped: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Upload media to Supabase Storage ──────────────────────────────────
        if (normalized.media_url || (normalized.evolution_message_key && normalized.message_type !== 'text')) {
            const persistentUrl = await downloadAndUploadMedia(normalized);
            normalized.media_url = persistentUrl;
        }

        // ── 1. Upsert Contact ─────────────────────────────────────────────────
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

        // ── 1.5. Upsert Deal ──────────────────────────────────────────────────
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

        // ── 2. Upsert Chat Session ────────────────────────────────────────────
        let sessionId: string | null = null;
        {
            const sessionProviderId = normalized.is_group ? normalized.group_id : normalized.phone;

            // Only use an actual group name (not the phone number fallback)
            // normalized.group_name is null when not provided in the webhook payload
            const incomingGroupName = normalized.is_group ? normalized.group_name : null;

            const { data: existingSession } = await supabase
                .from('chat_sessions')
                .select('id, name, contact_id')
                .eq('organization_id', orgId)
                .eq('provider_id', sessionProviderId)
                .maybeSingle();

            if (existingSession) {
                sessionId = existingSession.id;

                // Determine the best name to save:
                // 1. Use incoming group name from webhook (if present)
                // 2. If session has no name yet, try fetching from Evolution API
                // 3. If session already has a name, preserve it (never overwrite with null/phone)
                let nameToSave: string | null = null;
                if (incomingGroupName) {
                    nameToSave = incomingGroupName;
                } else if (!existingSession.name && normalized.is_group && providerType === 'evolution') {
                    nameToSave = await fetchGroupNameFromEvolution(sessionProviderId!, source);
                }
                // If nameToSave is null, skip the name field — existing name is preserved

                await supabase
                    .from('chat_sessions')
                    .update({
                        updated_at: new Date().toISOString(),
                        whatsapp_source_id: sourceId,
                        // Corrige contact_id se a sessão foi criada sem contato
                        ...(contactId && !existingSession.contact_id ? { contact_id: contactId } : {}),
                        ...(nameToSave ? { name: nameToSave } : {}),
                    })
                    .eq('id', sessionId);
            } else {
                // New session: try to get group name if not in payload
                let newSessionName = incomingGroupName;
                if (!newSessionName && normalized.is_group && providerType === 'evolution') {
                    newSessionName = await fetchGroupNameFromEvolution(sessionProviderId!, source);
                }

                const { data: newSession, error: upserr } = await supabase
                    .from('chat_sessions')
                    .upsert({
                        organization_id: orgId,
                        contact_id: contactId,
                        provider: 'whatsapp',
                        provider_id: sessionProviderId,
                        name: newSessionName,
                        whatsapp_source_id: sourceId,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'organization_id,provider_id', ignoreDuplicates: false })
                    .select('id')
                    .single();
                if (upserr) {
                    console.error('[webhook] ERROR UPSERT SESSION:', upserr);
                    return new Response(JSON.stringify({ error: upserr }), { status: 500 });
                }
                sessionId = newSession?.id ?? null;
            }
        }

        // ── 3. Insert Message ─────────────────────────────────────────────────
        if (sessionId) {
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

            let linkedExisting = false;
            if (normalized.from_me && normalized.external_id) {
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
                const { error: msgErr } = await supabase.from('messages').insert({
                    organization_id: orgId,
                    session_id: sessionId,
                    direction: normalized.direction,
                    content: normalized.text,
                    message_type: normalized.message_type,
                    media_url: normalized.media_url,
                    status: normalized.from_me ? 'sent' : 'delivered',
                    external_id: normalized.external_id,
                    sender_name: normalized.sender_name,
                    sender_phone: normalized.sender_phone,
                });

                if (msgErr) {
                    console.error('[Inbound] Error inserting message:', msgErr);
                }
            }
        }

        // ── 4. Audit Log ──────────────────────────────────────────────────────
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
            console.warn('[whatsapp-inbound] Warning: Failed to insert audit log', auditErr.message);
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
