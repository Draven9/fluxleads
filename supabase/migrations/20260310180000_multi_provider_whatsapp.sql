-- =============================================================================
-- MIGRATION: Multi-Provider WhatsApp Integration
-- Adds provider_type to integration_inbound_sources and links chat_sessions
-- to the source instance that originated the conversation.
-- =============================================================================

-- 1. Expand integration_inbound_sources with provider metadata
ALTER TABLE public.integration_inbound_sources
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'uazapi'
    CHECK (provider_type IN ('uazapi', 'evolution', 'meta')),
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- configuration JSONB column already exists (added in 20260205213000).
-- Expected shape per provider_type:
--   uazapi:    { "token": "...", "baseUrl": "https://api.uazapi.com" }
--   evolution: { "apiKey": "...", "instanceName": "...", "baseUrl": "https://..." }
--   meta:      { "phoneNumberId": "...", "accessToken": "...", "verifyToken": "..." }

-- 2. Link chat_sessions to the source number/instance
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS whatsapp_source_id UUID
  REFERENCES public.integration_inbound_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_sessions_whatsapp_source_id_idx
  ON public.chat_sessions (whatsapp_source_id);

-- 3. Expand webhook_events_in to record the provider type used
ALTER TABLE public.webhook_events_in
  ADD COLUMN IF NOT EXISTS provider_type TEXT;
