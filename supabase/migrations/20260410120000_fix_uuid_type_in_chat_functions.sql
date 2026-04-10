-- =============================================================================
-- FIX: Corrigir incompatibilidade de tipos UUID em funções e triggers de chat
-- DATA: 2026-04-10
-- 
-- CAUSA RAIZ:
--   A coluna chat_sessions.organization_id é do tipo UUID no banco de dados.
--   Dois lugares tentavam comparar/inserir valores TEXT nessa coluna UUID:
--   
--   1. upsert_chat_session: VALUES (p_org_id, ...) onde p_org_id é TEXT
--      Fix: VALUES (p_org_id::uuid, ...)
--
--   2. handle_new_chat_session_auto_deal trigger:
--      WHERE organization_id::text = NEW.organization_id
--      → boards.organization_id é UUID, cast para TEXT
--      → NEW.organization_id é UUID
--      → TEXT = UUID → ERRO "operator does not exist: text = uuid"
--      Fix: WHERE organization_id = NEW.organization_id (ambos UUID)
-- =============================================================================

-- ─── Fix 1: upsert_chat_session ──────────────────────────────────────────────

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
  VALUES (p_org_id::uuid, p_contact_id, p_provider, p_provider_id)
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

-- ─── Fix 2: handle_new_chat_session_auto_deal trigger ────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_chat_session_auto_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_id     UUID;
  v_stage_id     UUID;
  v_deal_id      UUID;
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
  -- FIX: ambos são UUID agora, sem cast desnecessário
  SELECT id INTO v_board_id
  FROM public.boards
  WHERE organization_id = NEW.organization_id
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
    NEW.organization_id,
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

-- Recreate the trigger (necessário para recarregar a função)
DROP TRIGGER IF EXISTS on_new_chat_session_auto_deal ON public.chat_sessions;

CREATE TRIGGER on_new_chat_session_auto_deal
  BEFORE INSERT ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_session_auto_deal();
