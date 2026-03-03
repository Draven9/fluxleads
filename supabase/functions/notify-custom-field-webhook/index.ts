import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Esse endpoint receberá dados do Database Webhook do Supabase
        // A estrutura do payload db webhook contém "type" e "record".
        const payload = await req.json();

        console.log("Recebido Payload Webhook:", payload);

        // Isso pode vir diretamente da interface de rede (API frontend)
        // Ou via Database Trigger. Vamos assumir que vem do frontend POST
        // ou do pg_net (banco de dados). 
        // Assumindo chamada manual direta da nossa API (Frontend para Function),
        // é mais rápido e garantido.
        // O payload esperado da API seria: { event: "campo_atualizado", url: "https://n8n...", data: { contact_id: "...", field_name: "...", value: "..." } }

        // Como a configuração original seria um database trigger chamando essa função,
        // vamos lidar com o padrão de Database Webhooks da tabela 'contact_custom_values'
        if (payload.type === 'UPDATE' || payload.type === 'INSERT') {
            const record = payload.record;

            // Vamos precisar invocar a URL configurada no custom_field.
            // E por segurança, pegar os dados do contato.
            const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            // 1. Pegar infos do field para ver a trigger_action (URL)
            const { data: fieldData, error: fieldError } = await supabaseClient
                .from('custom_fields')
                .select('name, trigger_action')
                .eq('id', record.field_id)
                .single();

            if (fieldError || !fieldData) {
                console.error("Erro ao buscar custom field:", fieldError);
                return new Response(JSON.stringify({ error: "Campo não encontrado" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
            }

            if (!fieldData.trigger_action) {
                console.log("Campo atualizado, mas sem webhook configurado.");
                return new Response(JSON.stringify({ message: "Sem trigger action" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }

            // 2. Pegar os dados do contato
            const { data: contactData, error: contactError } = await supabaseClient
                .from('contacts')
                .select('id, name, email, phone')
                .eq('id', record.contact_id)
                .single();

            if (contactError || !contactData) {
                console.error("Erro ao buscar contato:", contactError);
                return new Response(JSON.stringify({ error: "Contato não encontrado" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
            }

            // 3. Montar payload do N8n
            const n8nPayload = {
                event: `fluxleads_${payload.type.toLowerCase()}_custom_field`,
                contact: contactData,
                field: {
                    id: record.field_id,
                    name: fieldData.name,
                    value: record.value
                },
                timestamp: new Date().toISOString()
            };

            // 4. Disparar POST para o N8n
            console.log(`Disparando N8n Webhook: ${fieldData.trigger_action}`);

            const n8nResponse = await fetch(fieldData.trigger_action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(n8nPayload)
            });

            console.log("Resposta N8n:", n8nResponse.status, await n8nResponse.text());

            return new Response(JSON.stringify({ success: true, message: "Webhook disparado pro N8n" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        return new Response(JSON.stringify({ message: "Payload ignorado (não é INSERT/UPDATE)" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error("Erro no processamento:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
