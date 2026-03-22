
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, accept, x-client-info",
};

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }


    const { session_id, content, organization_id, media_url, media_name, media_mimetype, message_type: rawMessageType, reply_to_message_id, mentions, is_forwarded, forward_original_message_id } = await req.json();

    // Normalize WhatsApp message types: "imageMessage" -> "image", "videoMessage" -> "video", etc.
    const message_type = rawMessageType
        ? rawMessageType.replace(/Message$/i, '').toLowerCase()
        : (media_url ? 'image' : 'text');

    if (!session_id || (!content && !media_url) || !organization_id) {
        return json(400, { error: "Missing required fields (session_id, organization_id, and either content or media_url)" });
    }

    const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
        return json(500, { error: "Server configuration error" });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check - Manual verification since verify_jwt is false
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return json(401, { error: 'Missing Authorization header' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
        return json(401, { error: 'Unauthorized: Invalid Token' });
    }

    // 1. Insert message into DB
    const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
            organization_id,
            session_id,
            direction: "outbound",
            content: content || "",
            media_url: media_url || null,
            message_type: message_type,
            status: "sent",
            reply_to_message_id: reply_to_message_id || null
        })
        .select()
        .single();

    if (insertError) {
        return json(500, { error: "Failed to save message", details: insertError.message });
    }

    // 2. Fetch Chat Session to get Contact details (phone)
    const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .select("*, contact:contacts(name, phone, email, source)")
        .eq("id", session_id)
        .single();

    if (sessionError || !session) {
        return json(200, { ok: true, message: "Message saved but session not found for delivery" });
    }

    // 3. Prepare contact info
    let contactPhone = session.contact?.phone || "";
    const isGroup = session.contact?.source === 'whatsapp_group';

    if (isGroup && contactPhone && !contactPhone.includes('@')) {
        contactPhone = `${contactPhone}@g.us`;
    }

    // --- META DIRECT INTEGRATION ---
    if (session.provider === 'instagram' || session.provider === 'facebook') {
        const { data: metaConfig } = await supabase
            .from('organization_meta_configs')
            .select('access_token, page_id, ig_user_id')
            .eq('organization_id', organization_id)
            .eq('is_active', true)
            .single();

        if (!metaConfig || !metaConfig.access_token) {
            return json(400, { error: 'Meta configuration not found or access token missing.' });
        }

        const senderId = session.provider === 'instagram' ? metaConfig.ig_user_id : metaConfig.page_id;

        if (!senderId) {
            return json(400, { error: `Meta Configuration missing ${session.provider === 'instagram' ? 'Instagram User ID' : 'Facebook Page ID'}` });
        }

        const url = `https://graph.facebook.com/v19.0/${senderId}/messages`;

        // Build Graph API Payload
        let messagePayload: any = {};

        if (content && !media_url) {
            messagePayload = { text: content };
        } else if (media_url) {
            const fbTypeMap: Record<string, string> = {
                'image': 'image',
                'video': 'video',
                'audio': 'audio',
                'document': 'file',
                'file': 'file'
            };
            const mappedType = fbTypeMap[message_type] || 'file';

            messagePayload = {
                attachment: {
                    type: mappedType,
                    payload: { url: media_url, is_reusable: true }
                }
            };
        }

        const fbReqBody = {
            recipient: { id: session.provider_id },
            message: messagePayload
        };

        try {
            const fbRes = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${metaConfig.access_token}`
                },
                body: JSON.stringify(fbReqBody)
            });

            const fbData = await fbRes.json();

            if (!fbRes.ok) {
                console.error("Meta Graph API delivery failed:", fbData);
                await supabase.from('messages').update({ status: 'failed' }).eq('id', message.id);
                return json(400, { error: 'Failed to send via Meta Graph API', details: fbData });
            }

            await supabase.from('messages').update({ status: 'delivered', external_id: fbData.message_id }).eq('id', message.id);

            if (content && media_url) {
                const fbReqBodyText = {
                    recipient: { id: session.provider_id },
                    message: { text: content }
                };
                await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${metaConfig.access_token}`
                    },
                    body: JSON.stringify(fbReqBodyText)
                });
            }

            return json(200, { ok: true, message: "Message sent via Meta Graph API directly" });
        } catch (err) {
            console.error("Meta Graph API fetch error:", err);
            await supabase.from('messages').update({ status: 'failed' }).eq('id', message.id);
            return json(500, { error: 'Internal server error while calling Meta Graph API' });
        }
    }
    // --- END META DIRECT INTEGRATION ---

    // --- NATIVE WHATSAPP INTEGRATION (EVOLUTION / UAZAPI) ---
    if (session.provider === 'whatsapp') {
        // Prefer the source linked to this specific session; fallback to first active
        let sourceQuery = supabase
            .from('integration_inbound_sources')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('active', true);

        if (session.whatsapp_source_id) {
            sourceQuery = sourceQuery.eq('id', session.whatsapp_source_id);
        }

        const { data: sources } = await sourceQuery.limit(1);

        if (sources && sources.length > 0) {
            const source = sources[0];

            // Determine action (sendText, sendMedia, sendAudio)
            let proxyAction = 'sendText';
            if (media_url) {
                // Determine whether it's an audio (PTT) or media (document, image, video)
                proxyAction = message_type === 'audio' ? 'sendAudio' : 'sendMedia';
            }

            const proxyBody = {
                action: proxyAction,
                sourceId: source.id,
                phone: contactPhone,
                content: content,
                mediaUrl: media_url,
                mediaType: message_type,
                // optionally extract caption if it's media
                caption: (media_url && content) ? content : undefined
            };

            const { data: proxyData, error: proxyError } = await supabase.functions.invoke('whatsapp-proxy', {
                body: proxyBody,
                headers: { Authorization: authHeader }
            });

            if (proxyError || proxyData?.error) {
                const errDetail = proxyError?.message ?? (typeof proxyData?.error === 'string' ? proxyData.error : JSON.stringify(proxyData?.error));
                console.error("[chat-out] Native WhatsApp delivery failed:", errDetail);
                await supabase.from('messages').update({ status: 'failed' }).eq('id', message.id);
                // Return 200 so the frontend does not remove the message from the UI.
                // The message is already persisted in the DB with status "failed"; the
                // Realtime subscription will update the UI accordingly.
                return json(200, { ok: false, warning: 'WhatsApp delivery failed', details: errDetail });
            }

            await supabase.from('messages').update({ status: 'delivered' }).eq('id', message.id);
            return json(200, { ok: true, message: "Message sent via Native WhatsApp integration" });
        }
    }
    // --- END NATIVE WHATSAPP INTEGRATION ---

    // 4. Fallback: External Webhook (n8n)
    const { data: endpoints } = await supabase
        .from("integration_outbound_endpoints")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("active", true)
        .limit(1);

    const endpoint = endpoints?.[0];

    if (!endpoint) {
        return json(200, { ok: true, warning: "No active native integration or outbound webhook configured. Message saved locally." });
    }

    // Prepare payload for n8n webhook
    const contactPayload = {
        ...session.contact,
        phone: contactPhone
    };

    // Fetch quoted message details if replying
    let replyToExternalId = null;
    let replyToContent = null;

    if (reply_to_message_id) {
        const { data: quotedMsg } = await supabase
            .from('messages')
            .select('external_id, content, direction')
            .eq('id', reply_to_message_id)
            .single();

        if (quotedMsg) {
            replyToExternalId = quotedMsg.external_id;
            replyToContent = quotedMsg.content;
        }
    }

    // Fetch forwarded message details if forwarding
    let forwardExternalId = null;
    if (is_forwarded && forward_original_message_id) {
        const { data: fwdMsg } = await supabase
            .from('messages')
            .select('external_id')
            .eq('id', forward_original_message_id)
            .single();

        forwardExternalId = fwdMsg?.external_id;
    }

    const payload = {
        event: "chat.new_message",
        data: {
            message_id: message.id,
            session_id: session.id,
            contact: contactPayload,
            content: content,
            media_url: media_url,
            message_type: message_type,
            provider_id: session.provider_id,
            created_at: message.created_at,
            reply_to_message_id: reply_to_message_id,
            reply_to_message_external_id: replyToExternalId,
            reply_to_message_content: replyToContent,
            mentions: mentions || [],
            is_forwarded: is_forwarded || false,
            forward_message_external_id: forwardExternalId,
            fileName: media_name,
            mimetype: media_mimetype
        }
    };

    try {
        const res = await fetch(endpoint.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Webhook-Secret": endpoint.secret || "",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            console.error("Webhook delivery failed:", await res.text());
        }
    } catch (err) {
        console.error("Webhook fetch error:", err);
    }

    return json(200, { ok: true, message: "Message sent and delivered to webhook" });
});
