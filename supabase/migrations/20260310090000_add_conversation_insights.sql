-- FASE 4.3 — Análise de Sentimento de Conversas
-- Tabela para armazenar análises de sentimento por sessão de chat

CREATE TABLE IF NOT EXISTS public.conversation_insights (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,

    -- Resultado da análise de sentimento
    sentiment text NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    sentiment_score numeric(4, 3) NOT NULL CHECK (sentiment_score BETWEEN -1 AND 1),

    -- Resumo e próximos passos sugeridos pela IA
    summary text,
    suggested_action text,

    -- Metadados do processamento
    messages_analyzed integer NOT NULL DEFAULT 0,
    last_message_at timestamptz,
    analyzed_at timestamptz NOT NULL DEFAULT now(),

    -- Soft-expiry: reanalisa se esta insight tiver mais de 24h
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Uma análise por sessão (upsert)
    UNIQUE (session_id)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_conversation_insights_org ON public.conversation_insights(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_session ON public.conversation_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_sentiment ON public.conversation_insights(sentiment);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_expires ON public.conversation_insights(expires_at);

-- RLS
ALTER TABLE public.conversation_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org insights"
    ON public.conversation_insights FOR SELECT
    USING (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Service role can manage insights"
    ON public.conversation_insights FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Garantir que a função set_updated_at existe (cria se não existir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger para updated_at automático
CREATE TRIGGER set_conversation_insights_updated_at
    BEFORE UPDATE ON public.conversation_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
