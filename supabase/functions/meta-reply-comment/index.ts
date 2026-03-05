import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

Deno.serve(async (req: Request) => {
    // 1. Handle CORS Preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        // 2. Parse Body
        const { comment_id, provider, content, organization_id } = await req.json();

        if (!comment_id || !content || !organization_id || !provider) {
            return json(400, { error: "Missing required fields (comment_id, provider, content, organization_id)" });
        }

        // 3. Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        if (!supabaseUrl || !serviceKey) {
            return json(500, { error: "Server configuration error" });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceKey);

        // 4. Verify Auth / JWT
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return json(401, { error: 'Missing Authorization header' });
        }

        const supabaseUserClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        });

        const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

        if (authError || !user) {
            return json(401, { error: 'Unauthorized: Invalid Token' });
        }

        // Optional: Verify user actually belongs to requested organization_id
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        if (!profile || profile.organization_id !== organization_id) {
            return json(403, { error: 'Forbidden: You do not have access to this organization' });
        }

        // 5. Fetch Meta Access Token for this Organization
        const { data: metaConfig } = await supabaseAdmin
            .from('organization_meta_configs')
            .select('facebook_access_token')
            .eq('organization_id', organization_id)
            .eq('active', true)
            .maybeSingle();

        if (!metaConfig || !metaConfig.facebook_access_token) {
            return json(400, { error: 'Meta configuration not found or access token missing.' });
        }

        // 6. Call Graph API to reply to the comment
        // The endpoint is {comment-id}/comments regardless of Facebook or Instagram, using the Page Access Token
        const graphApiUrl = `https://graph.facebook.com/v19.0/${comment_id}/comments`;

        const fbRes = await fetch(graphApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: content,
                access_token: metaConfig.facebook_access_token
            })
        });

        const fbData = await fbRes.json();

        if (!fbRes.ok) {
            console.error("Meta Graph API delivery failed:", fbData);
            return json(400, { error: 'Failed to reply via Meta Graph API', details: fbData });
        }

        // Successfully replied
        return json(200, { ok: true, message: "Comment replied successfully", id: fbData.id });

    } catch (err) {
        console.error("Internal Error in meta-reply-comment:", err);
        return json(500, { error: "Internal Server Error" });
    }
});
