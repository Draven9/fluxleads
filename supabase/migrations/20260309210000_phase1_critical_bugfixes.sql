-- =============================================================================
-- MIGRATION: PHASE 1 — CRITICAL BUG FIXES
-- Date: 2026-03-09
-- Purpose: Fix duplicate messages, leads not appearing on board,
--          duplicate contacts, and idempotent webhook processing
-- =============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1.1: Deduplication of messages by external_id
-- Problem: Webhook retries create duplicate messages in the same conversation
-- Solution: Add UNIQUE constraint on (external_id, organization_id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD CONSTRAINT IF NOT EXISTS messages_external_id_org_unique
  UNIQUE (external_id, organization_id);

-- Performance index for external_id lookups (webhook dedup check)
CREATE INDEX IF NOT EXISTS idx_messages_external_id
  ON public.messages(external_id)
  WHERE external_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- FIX 1.2: Idempotent upsert function for contacts via webhook
-- Problem: Concurrent webhooks create duplicate contacts for the same phone
-- Note: contacts_org_phone_idx already exists from 20260205220000 migration
-- Solution: Provide a safe UPSERT function for webhook handlers to use
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_contact_from_webhook(
  p_phone     TEXT,
  p_name      TEXT,
  p_org_id    TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Normalize phone: strip non-numeric chars, keep + prefix
  p_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');

  INSERT INTO public.contacts (phone, name, organization_id)
  VALUES (p_phone, p_name, p_org_id::uuid)
  ON CONFLICT (organization_id, phone)
  DO UPDATE SET
    name        = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name),
    updated_at  = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Grant execute to authenticated users (webhook edge functions run as auth user)
GRANT EXECUTE ON FUNCTION public.upsert_contact_from_webhook(TEXT, TEXT, TEXT)
  TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- FIX 1.3: Idempotent upsert for chat_sessions via webhook
-- Problem: Duplicate provider_id creates multiple sessions for same contact
-- Note: chat_sessions_org_contact_idx already exists from 20260205221000
-- Solution: Add unique constraint on provider_id per org + upsert function
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS chat_sessions_provider_id_org_idx
  ON public.chat_sessions(organization_id, provider_id)
  WHERE provider_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_chat_session(
  p_org_id      TEXT,
  p_contact_id  UUID,
  p_provider    TEXT,
  p_provider_id TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.chat_sessions (organization_id, contact_id, provider, provider_id)
  VALUES (p_org_id, p_contact_id, p_provider, p_provider_id)
  ON CONFLICT (organization_id, provider_id)
  DO UPDATE SET
    contact_id  = COALESCE(EXCLUDED.contact_id, chat_sessions.contact_id),
    updated_at  = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_chat_session(TEXT, UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- FIX 1.4: Auto-create Deal when a new chat_session arrives without a deal
-- Problem: Leads that arrive via WhatsApp/webhook have a chat_session and
--          contact created, but NO deal is created, so they never appear on the Board.
-- Solution: Trigger that creates a deal in the org's default board when a
--           new session is inserted without an associated deal_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_chat_session_auto_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_id    UUID;
  v_stage_id    UUID;
  v_deal_id     UUID;
  v_contact_name TEXT;
BEGIN
  -- Only act when there is no deal linked yet
  IF NEW.deal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only act when there is a contact linked
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the first active board for the organization
  SELECT id INTO v_board_id
  FROM public.boards
  WHERE organization_id::text = NEW.organization_id
    AND (is_archived IS NULL OR is_archived = false)
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no board found, skip (don't block the insert)
  IF v_board_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the first (lowest position) stage of that board
  SELECT id INTO v_stage_id
  FROM public.board_stages
  WHERE board_id = v_board_id
  ORDER BY position ASC
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the contact's name for the deal title
  SELECT COALESCE(name, phone, 'Lead sem nome') INTO v_contact_name
  FROM public.contacts
  WHERE id = NEW.contact_id;

  -- Create the deal
  INSERT INTO public.deals (
    organization_id,
    board_id,
    contact_id,
    title,
    status,
    value,
    priority
  )
  VALUES (
    NEW.organization_id::uuid,
    v_board_id,
    NEW.contact_id,
    v_contact_name || ' — Lead',
    v_stage_id::text,
    0,
    'medium'
  )
  RETURNING id INTO v_deal_id;

  -- Link the deal back to the session
  NEW.deal_id := v_deal_id;

  RETURN NEW;
END;
$$;

-- Drop if exists from a previous attempt, then recreate
DROP TRIGGER IF EXISTS on_new_chat_session_auto_deal ON public.chat_sessions;

CREATE TRIGGER on_new_chat_session_auto_deal
  BEFORE INSERT ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_session_auto_deal();

-- ----------------------------------------------------------------------------
-- FIX 1.5: Webhook event queue for idempotent processing
-- Problem: Webhooks from Meta/WhatsApp/Evolution can fire multiple times
--          for the same event. Without a queue, events are double-processed.
-- Solution: An event queue table with UNIQUE on idempotency_key
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider         TEXT        NOT NULL CHECK (provider IN ('whatsapp', 'meta', 'evolution', 'instagram', 'other')),
  event_type       TEXT        NOT NULL,
  payload          JSONB       NOT NULL DEFAULT '{}',
  idempotency_key  TEXT        NOT NULL,     -- SHA-256 hash of (provider + event_id/payload hash)
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts         INTEGER     NOT NULL DEFAULT 0,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ,
  UNIQUE (idempotency_key)
);

-- RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (webhook Edge Functions use service_role key)
CREATE POLICY "service_role_full_access_webhook_events"
  ON public.webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view (for debugging)
CREATE POLICY "admins_view_webhook_events"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Performance indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_created
  ON public.webhook_events(status, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_webhook_events_org
  ON public.webhook_events(organization_id);

-- ----------------------------------------------------------------------------
-- FIX 1.6: Structured audit log for deal/contact mutations
-- Problem: No way to trace when/why data changed — makes debugging impossible
-- Solution: Lightweight audit log table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID      REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type   TEXT        NOT NULL,  -- 'deal', 'contact', 'message', 'session'
  entity_id     UUID        NOT NULL,
  action        TEXT        NOT NULL CHECK (action IN ('create', 'update', 'delete', 'move', 'merge')),
  changes       JSONB       DEFAULT '{}',  -- { "before": {...}, "after": {...} }
  source        TEXT        DEFAULT 'user' CHECK (source IN ('user', 'webhook', 'automation', 'system')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_org_audit"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "service_role_insert_audit"
  ON public.audit_logs
  FOR INSERT
  TO service_role, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs(organization_id, created_at DESC);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
