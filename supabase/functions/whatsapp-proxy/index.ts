import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Auth check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        // Get Payload with multiple possible params
        const { action, groupJid } = await req.json();

        // Common Logic: Get Configuration
        // We need organization_id to find the source
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            throw new Error('Organization not found for user');
        }

        // Find the WhatsApp source config
        const { data: source } = await supabase
            .from('integration_inbound_sources')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .limit(1)
            .single();

        if (!source) throw new Error(`WhatsApp integration not configured (Org: ${profile.organization_id})`);

        const config = source.configuration as any;
        const apiUrl = config.apiUrl?.replace(/\/$/, '');
        const apiKey = config.apiKey;
        const instanceName = config.instanceName;

        if (!apiUrl || !apiKey || !instanceName) {
            throw new Error('Invalid Integration Configuration: Missing URL, Key, or Instance');
        }

        // --- ACTIONS ---

        if (action === 'fetchGroups') {
            const url = `${apiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`;
            console.log(`Fetching groups from: ${url}`);

            const response = await fetch(url, {
                headers: { 'apikey': apiKey, 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro na API Evolution: ${errText}`);
            }

            const groups = await response.json();
            return new Response(JSON.stringify(groups), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (action === 'fetchParticipants') {
            if (!groupJid) throw new Error('Missing groupJid for fetchParticipants');

            // Evolution API endpoint for participants
            const url = `${apiUrl}/group/participants/${instanceName}?groupJid=${groupJid}`;
            console.log(`Fetching participants from: ${url}`);

            const response = await fetch(url, {
                headers: { 'apikey': apiKey, 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errText = await response.text();
                // If specific 404/400, handle gracefully? For now throw.
                throw new Error(`Erro na API Evolution: ${errText}`);
            }

            const data = await response.json();
            // Data structure usually contains 'participants' array inside, or is the array itself.
            // Evolution v2: returns { participants: [...] } or just array depending on version.
            // Let's return the raw data and handle formatting in frontend/lib.

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Unknown Action' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
