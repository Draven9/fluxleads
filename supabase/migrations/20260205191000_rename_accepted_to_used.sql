-- =============================================================================
-- MIGRATION: 20260205191000_rename_accepted_to_used.sql
-- PURPOSE: Rename 'accepted_at' to 'used_at' in organization_invites to match codebase.
-- AUTHOR: Antigravity Agent
-- =============================================================================

-- Rename column if it exists and the target doesn't
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_invites' AND column_name='accepted_at') THEN
        ALTER TABLE public.organization_invites RENAME COLUMN accepted_at TO used_at;
    END IF;
END $$;

-- Fallback: Ensure used_at exists if renaming didn't happen (e.g. accepted_at didn't exist)
ALTER TABLE public.organization_invites ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
