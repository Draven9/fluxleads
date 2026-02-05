import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

        // Auth check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        // Get Payload
        const { action, instanceDetails } = await req.json();

        if (action === 'fetchGroups') {
            // Fetch groups from Evolution API
            // We expect instanceDetails to contain the URL and API Key
            // OR we fetch them from 'integration_inbound_sources' if we passed a sourceId.
            // For simplicity/security, let's look up the source in the DB based on the user's organization.

            // Fetch user profile first to get organization_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (!profile?.organization_id) {
                throw new Error('Organization not found for user');
            }

            const { data: source } = await supabase
                .from('integration_inbound_sources')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .eq('type', 'whatsapp_evolution')
                .limit(1)
                .single();

            if (!source || !source.configuration) {
                throw new Error(`WhatsApp integration not configured (Org: ${profile.organization_id})`);
            }

            const config = source.configuration as any;
            // Remove trailing slash if present
            const apiUrl = config.apiUrl?.replace(/\/$/, '');
            const apiKey = config.apiKey;
            const instanceName = config.instanceName;

            if (!apiUrl || !apiKey || !instanceName) {
                throw new Error('Invalid Integration Configuration: Missing URL, Key, or Instance');
            }

            // Evolution API: Try v1 style first
            // Note: Evolution v1 usually uses /group/fetchAllGroups/{instance}
            // If v2, it might be /group/fetch-all/{instance} - verifying docs needed usually, but assuming v1 for now as per original code.
            const url = `${apiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`;

            console.log(`Fetching groups from: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Evolution API Error: ${errText}`);
            }

            const groups = await response.json();
            return new Response(JSON.stringify(groups), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Unknown Action' }), { status: 400, headers: corsHeaders });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
