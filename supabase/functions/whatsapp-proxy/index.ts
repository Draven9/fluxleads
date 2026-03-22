import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// ════════════════════════════════════════════════════════════════════════════
//  PROVIDER ADAPTERS
//  Each provider adapter handles the specifics of the WhatsApp API it wraps.
// ════════════════════════════════════════════════════════════════════════════

async function sendUazapi(config: any, action: string, payload: any) {
    const baseUrl = (config.baseUrl || 'https://api.uazapi.com').replace(/\/$/, '');
    const token = config.token;
    if (!token) throw new Error('uazapi: missing token in configuration');

    const headers: Record<string, string> = { 'token': token, 'Content-Type': 'application/json' };

    if (action === 'sendText') {
        const res = await fetch(`${baseUrl}/send/text`, {
            method: 'POST', headers,
            body: JSON.stringify({ phone: payload.phone, message: payload.content }),
        });
        return res.json();
    }
    if (action === 'sendMedia') {
        const res = await fetch(`${baseUrl}/send/media`, {
            method: 'POST', headers,
            body: JSON.stringify({ phone: payload.phone, url: payload.mediaUrl, mediatype: payload.mediaType, caption: payload.caption }),
        });
        return res.json();
    }
    if (action === 'sendAudio') {
        const res = await fetch(`${baseUrl}/send/audio`, {
            method: 'POST', headers,
            body: JSON.stringify({ phone: payload.phone, url: payload.mediaUrl }),
        });
        return res.json();
    }
    if (action === 'fetchGroups') {
        const res = await fetch(`${baseUrl}/group/list`, { headers });
        return res.json();
    }
    if (action === 'fetchParticipants') {
        const res = await fetch(`${baseUrl}/group/info?groupJid=${payload.groupJid}`, { headers });
        return res.json();
    }
    if (action === 'instanceStatus') {
        const res = await fetch(`${baseUrl}/instance/status`, { headers });
        return res.json();
    }
    throw new Error(`uazapi: unknown action "${action}"`);
}

async function sendEvolution(config: any, action: string, payload: any) {
    const baseUrl = (config.baseUrl || config.apiUrl || '').replace(/\/$/, '');
    const apiKey = config.apiKey;
    const instanceName = config.instanceName;
    if (!baseUrl || !apiKey || !instanceName) throw new Error('evolution: missing baseUrl, apiKey, or instanceName');

    const headers: Record<string, string> = { 'apikey': apiKey, 'Content-Type': 'application/json' };

    if (action === 'sendText') {
        const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
            method: 'POST', headers,
            body: JSON.stringify({ number: payload.phone, text: payload.content }),
        });
        return res.json();
    }
    if (action === 'sendMedia') {
        const res = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
            method: 'POST', headers,
            body: JSON.stringify({ number: payload.phone, media: payload.mediaUrl, mediatype: payload.mediaType, caption: payload.caption }),
        });
        return res.json();
    }
    if (action === 'sendAudio') {
        const res = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${instanceName}`, {
            method: 'POST', headers,
            body: JSON.stringify({ number: payload.phone, audio: payload.mediaUrl }),
        });
        return res.json();
    }
    if (action === 'fetchGroups') {
        // Try rich info first, fallback to basic list
        try {
            const res = await fetch(`${baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`, { headers });
            if (res.ok) return res.json();
        } catch (_) { /* fallthrough */ }
        const res = await fetch(`${baseUrl}/group/list/${instanceName}`, { headers });
        return res.json();
    }
    if (action === 'fetchParticipants') {
        try {
            const infoRes = await fetch(`${baseUrl}/group/findGroupInfos/${instanceName}?groupJid=${payload.groupJid}`, { headers });
            if (infoRes.ok) {
                const info = await infoRes.json();
                const g = Array.isArray(info) ? info[0] : info;
                if (g?.participants) return { participants: g.participants, groupName: g.subject || null };
            }
        } catch (_) { /* fallthrough */ }
        const res = await fetch(`${baseUrl}/group/participants/${instanceName}?groupJid=${payload.groupJid}`, { headers });
        return res.json();
    }
    if (action === 'instanceStatus') {
        const res = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, { headers });
        return res.json();
    }
    throw new Error(`evolution: unknown action "${action}"`);
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // ── Auth ──────────────────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        // Detect service-role calls (server-to-server from chat-out).
        // Service role JWTs have role='service_role' in the payload.
        let isServiceRole = false;
        try {
            // JWTs use base64url (- and _); atob requires standard base64 (+ and /)
            const b64 = authHeader.replace('Bearer ', '').split('.')[1]
                .replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(b64));
            isServiceRole = payload?.role === 'service_role';
        } catch (_) { /* invalid JWT — will fail below */ }

        // ── Parse body ────────────────────────────────────────────────────
        const body = await req.json();
        const { action, sourceId, groupJid, phone, content, mediaUrl, mediaType, caption } = body;

        // ── Resolve source instance ───────────────────────────────────────
        let sourceQuery = supabase
            .from('integration_inbound_sources')
            .select('*')
            .eq('active', true);

        if (isServiceRole) {
            // Trusted server call — sourceId is required; org scoping is done by ID
            if (!sourceId) throw new Error('sourceId is required for server calls');
            sourceQuery = sourceQuery.eq('id', sourceId);
        } else {
            // User call — validate JWT and scope by organization
            const { data: { user }, error: authError } = await supabase.auth.getUser(
                authHeader.replace('Bearer ', '')
            );
            if (authError || !user) throw new Error('Unauthorized');

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (!profile?.organization_id) throw new Error('Organization not found for user');

            sourceQuery = sourceQuery.eq('organization_id', profile.organization_id);
            if (sourceId) {
                sourceQuery = sourceQuery.eq('id', sourceId);
            } else {
                sourceQuery = sourceQuery.limit(1);
            }
        }

        const { data: source } = await sourceQuery.single();
        if (!source) throw new Error(`WhatsApp integration not configured (sourceId: ${sourceId})`);

        const config = source.configuration as any;
        const providerType: string = source.provider_type || config?.providerType || 'evolution';

        // ── Dispatch to provider ──────────────────────────────────────────
        const payload = { phone, content, mediaUrl, mediaType, caption, groupJid };
        let result: any;

        if (providerType === 'uazapi') {
            result = await sendUazapi(config, action, payload);
        } else if (providerType === 'evolution') {
            result = await sendEvolution(config, action, payload);
        } else {
            throw new Error(`Unsupported provider_type: "${providerType}"`);
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[whatsapp-proxy]', error?.message);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
