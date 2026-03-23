-- Migration: Fix duplicate deals created by auto_deal trigger
--
-- Root cause: whatsapp-inbound creates a deal BEFORE creating the chat_session.
-- When the session INSERT fires, the trigger sees NEW.deal_id = NULL (because the
-- deal was created separately and not passed in), skips the only guard check, and
-- inserts a second deal for the same contact — resulting in duplicates on the board.
--
-- Fix: Add an existence check by (contact_id, board_id) before inserting.
-- If a deal already exists, link it to the session instead of creating a new one.

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
  SELECT id INTO v_board_id
  FROM public.boards
  WHERE organization_id::text = NEW.organization_id
    AND (is_archived IS NULL OR is_archived = false)
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_board_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- FIX: Check if an open deal already exists for this contact in this board.
  -- whatsapp-inbound creates the deal BEFORE creating the session, so by the time
  -- this trigger fires the deal already exists but NEW.deal_id is still NULL.
  SELECT id INTO v_deal_id
  FROM public.deals
  WHERE contact_id = NEW.contact_id
    AND board_id   = v_board_id
    AND is_won     = false
    AND is_lost    = false
  LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    -- Link the existing deal to the session instead of creating a duplicate
    NEW.deal_id := v_deal_id;
    RETURN NEW;
  END IF;

  -- No deal found — create one (original behaviour)
  SELECT id INTO v_stage_id
  FROM public.board_stages
  WHERE board_id = v_board_id
  ORDER BY position ASC
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, phone, 'Lead sem nome') INTO v_contact_name
  FROM public.contacts
  WHERE id = NEW.contact_id;

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

  NEW.deal_id := v_deal_id;
  RETURN NEW;
END;
$$;
