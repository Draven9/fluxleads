-- =============================================================================
-- ORG AI ENABLE TOGGLE (admin-only config)
-- Generated at: 2025-12-25
-- =============================================================================

ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true;

