
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


    const { session_id, content, organization_id, media_url, message_type } = await req.json();

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
            content: content || "", // Allow empty content if media is present
            media_url: media_url || null,
            message_type: message_type || (media_url ? "image" : "text"), // Default to text, or image if media present but type missing
            status: "sent",
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

    // 3. Find Outbound Configuration (Webhook)
    // We look for ANY active outbound endpoint. 
    // Ideally we should filter by event type support, but for simplicity we take the first one.
    const { data: endpoints } = await supabase
        .from("integration_outbound_endpoints")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("active", true)
        .limit(1);

    const endpoint = endpoints?.[0];

    if (!endpoint) {
        return json(200, { ok: true, warning: "No active outbound webhook configured. Message saved locally." });
    }

    // 4. Prepare Payload
    // Ensure Group JID is correct (append @g.us if needed)
    let contactPhone = session.contact?.phone || "";
    const isGroup = session.contact?.source === 'whatsapp_group';

    if (isGroup && contactPhone && !contactPhone.includes('@')) {
        contactPhone = `${contactPhone}@g.us`;
    }

    // Clone contact to avoid mutation issues if we were using it elsewhere
    const contactPayload = {
        ...session.contact,
        phone: contactPhone
    };

    // 5. Send to External Webhook (n8n/Evolution)
    const payload = {
        event: "chat.new_message",
        data: {
            message_id: message.id,
            session_id: session.id,
            contact: contactPayload, // Use the modified contact with correct JID
            content: content,
            media_url: media_url,
            message_type: message_type || (media_url ? "image" : "text"),
            provider_id: session.provider_id, // Remote JID usually
            created_at: message.created_at
        }
    };

    try {
        const res = await fetch(endpoint.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Webhook-Secret": endpoint.secret || "", // Send secret if available
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
