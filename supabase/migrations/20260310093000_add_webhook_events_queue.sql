-- FASE 5.2 — Fila de Webhooks Assíncrona
-- Garante idempotência, retry automático e processamento assíncrono
-- para webhooks do Meta (Facebook/Instagram)

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid, -- pode ser null antes de mapear a org

    -- Identificação do evento
    provider text NOT NULL CHECK (provider IN ('whatsapp', 'meta', 'instagram', 'facebook', 'evolution', 'generic')),
    event_type text NOT NULL,           -- 'message', 'comment', 'reaction', etc.
    idempotency_key text NOT NULL,      -- SHA-256 do payload (garante unicidade)

    -- Payload original
    payload jsonb NOT NULL,

    -- Controle de processamento
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'done', 'failed')),
    attempts integer NOT NULL DEFAULT 0,
    last_error text,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,

    -- Garantia de unicidade por chave de idempotência
    UNIQUE (idempotency_key)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider, status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_org ON public.webhook_events(organization_id, created_at DESC);

-- RLS: apenas service role pode acessar (webhooks são processados pelo backend)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages webhook events"
    ON public.webhook_events FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
