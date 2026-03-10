// Edge Function: analyze-conversation-sentiment
// Analisa o sentimento das últimas mensagens de uma sessão de chat usando IA.
// Pode ser chamada: 1) manualmente via API Route, 2) via pg_cron periodicamente.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface MessageRow {
    id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    created_at: string;
    message_type: string;
}

interface SentimentResult {
    sentiment: 'positive' | 'neutral' | 'negative';
    sentiment_score: number; // -1 a 1
    summary: string;
    suggested_action: string;
}

async function analyzeSentimentWithAI(
    messages: MessageRow[],
    aiProvider: string,
    aiApiKey: string,
    modelId: string
): Promise<SentimentResult> {
    // Formatar mensagens para o prompt
    const conversation = messages
        .filter(m => m.content && m.message_type === 'text')
        .slice(-20) // Últimas 20 mensagens
        .map(m => `[${m.direction === 'inbound' ? 'CLIENTE' : 'ATENDENTE'}]: ${m.content}`)
        .join('\n');

    const prompt = `Analise o sentimento desta conversa de atendimento ao cliente e responda APENAS com JSON válido:

CONVERSA:
${conversation}

Responda com este JSON exato:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentiment_score": número entre -1.0 (muito negativo) e 1.0 (muito positivo),
  "summary": "resumo da conversa em 1 frase (máx 100 chars)",
  "suggested_action": "próxima ação recomendada em 1 frase (máx 80 chars)"
}`;

    // Construir requisição baseada no provider
    let apiUrl: string;
    let body: object;
    let headers: Record<string, string>;

    if (aiProvider === 'google' || aiProvider === 'gemini') {
        const model = modelId || 'gemini-1.5-flash';
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiApiKey}`;
        body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
        };
        headers = { 'Content-Type': 'application/json' };
    } else if (aiProvider === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        body = {
            model: modelId || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 256,
            response_format: { type: 'json_object' }
        };
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` };
    } else {
        // Anthropic Claude
        apiUrl = 'https://api.anthropic.com/v1/messages';
        body = {
            model: modelId || 'claude-3-haiku-20240307',
            max_tokens: 256,
            messages: [{ role: 'user', content: prompt }]
        };
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': aiApiKey,
            'anthropic-version': '2023-06-01'
        };
    }

    const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`AI API error: ${res.status}`);

    const data = await res.json();

    // Extrair o texto da resposta
    let text: string;
    if (aiProvider === 'google' || aiProvider === 'gemini') {
        text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (aiProvider === 'openai') {
        text = data.choices?.[0]?.message?.content || '';
    } else {
        text = data.content?.[0]?.text || '';
    }

    // Limpar possível markdown e parsear JSON
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonText) as SentimentResult;
}

Deno.serve(async (req: Request) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
    };

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    let sessionId: string | null = null;
    let organizationId: string | null = null;

    try {
        const body = await req.json();
        sessionId = body.session_id;
        organizationId = body.organization_id;
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
    }

    if (!sessionId || !organizationId) {
        return new Response(JSON.stringify({ error: 'session_id and organization_id required' }), { status: 400 });
    }

    // 1. Buscar configuração de IA da organização
    const settingsRes = await fetch(
        `${supabaseUrl}/rest/v1/organization_settings?organization_id=eq.${organizationId}&select=ai_provider,ai_api_key,ai_model_id&limit=1`,
        { headers }
    );
    const settingsArr = await settingsRes.json();
    const settings = settingsArr[0];

    if (!settings?.ai_api_key) {
        return new Response(JSON.stringify({ error: 'AI not configured for this organization' }), { status: 422 });
    }

    // 2. Buscar mensagens da sessão (últimas 30)
    const messagesRes = await fetch(
        `${supabaseUrl}/rest/v1/messages?session_id=eq.${sessionId}&select=id,content,direction,created_at,message_type&order=created_at.desc&limit=30`,
        { headers }
    );
    const messages: MessageRow[] = await messagesRes.json();

    if (!messages.length) {
        return new Response(JSON.stringify({ error: 'No messages found' }), { status: 404 });
    }

    // 3. Analisar sentimento com IA
    const result = await analyzeSentimentWithAI(
        messages.reverse(),
        settings.ai_provider || 'google',
        settings.ai_api_key,
        settings.ai_model_id || ''
    );

    const lastMessageAt = messages[messages.length - 1]?.created_at;

    // 4. Upsert na tabela conversation_insights
    const upsertPayload = {
        organization_id: organizationId,
        session_id: sessionId,
        sentiment: result.sentiment,
        sentiment_score: result.sentiment_score,
        summary: result.summary,
        suggested_action: result.suggested_action,
        messages_analyzed: messages.length,
        last_message_at: lastMessageAt,
        analyzed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    await fetch(
        `${supabaseUrl}/rest/v1/conversation_insights`,
        {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(upsertPayload),
        }
    );

    return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
});
