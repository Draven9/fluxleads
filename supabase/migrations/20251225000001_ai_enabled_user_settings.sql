-- =============================================================================
-- AI ENABLE TOGGLE (per user)
-- Generated at: 2025-12-25
-- =============================================================================

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true;

