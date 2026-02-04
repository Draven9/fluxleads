
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

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const { session_id, content, organization_id } = await req.json();

    if (!session_id || !content || !organization_id) {
        return json(400, { error: "Missing required fields" });
    }

    const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
        return json(500, { error: "Server configuration error" });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Insert message into DB
    const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
            organization_id,
            session_id,
            direction: "outbound",
            content, // Already formatted by frontend e.g. *[User]:* ...
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
        .select("*, contact:contacts(name, phone, email)")
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

    // 4. Send to External Webhook (n8n/Evolution)
    const payload = {
        event: "chat.new_message",
        data: {
            message_id: message.id,
            session_id: session.id,
            contact: session.contact,
            content: content,
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
