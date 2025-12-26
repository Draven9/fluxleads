-- =============================================================================
-- DROP per-user ai_enabled (we use org-wide toggle instead)
-- Generated at: 2025-12-25
-- =============================================================================

ALTER TABLE public.user_settings
DROP COLUMN IF EXISTS ai_enabled;

