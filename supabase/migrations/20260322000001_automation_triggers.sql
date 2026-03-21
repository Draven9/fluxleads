-- ============================================================
-- Gatilhos PostgreSQL para disparo de automações
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Funções RPC para ações de tag (chamadas pela edge function)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION append_deal_tag(p_deal_id uuid, p_tag text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE deals
     SET tags = array_append(COALESCE(tags, '{}'), p_tag)
   WHERE id = p_deal_id
     AND NOT (p_tag = ANY(COALESCE(tags, '{}')));
$$;

CREATE OR REPLACE FUNCTION remove_deal_tag(p_deal_id uuid, p_tag text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE deals
     SET tags = array_remove(COALESCE(tags, '{}'), p_tag)
   WHERE id = p_deal_id;
$$;

-- ──────────────────────────────────────────────────────────────
-- Função helper: encontra automações ativas e enfileira runs
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_queue_automation_runs(
  p_org_id      uuid,
  p_trigger_type text,
  p_context     jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO automation_runs (automation_id, organization_id, trigger_type, context)
  SELECT id, organization_id, p_trigger_type, p_context
  FROM automations
  WHERE active = true
    AND organization_id = p_org_id
    AND trigger_type = p_trigger_type;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Gatilho: deals → lead_created, lead_created_in_stage,
--           stage_changed, owner_changed, deal_won, deal_lost,
--           custom_field_updated, tag_added, tag_removed
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_deals_automation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  added_tag   text;
  removed_tag text;
BEGIN
  -- ── INSERT: lead criado ──
  IF TG_OP = 'INSERT' THEN
    -- lead_created (qualquer)
    PERFORM fn_queue_automation_runs(
      NEW.organization_id, 'lead_created',
      jsonb_build_object(
        'deal_id', NEW.id,
        'contact_id', NEW.contact_id,
        'stage_id', NEW.status,
        'board_id', NEW.board_id
      )
    );

    -- lead_created_in_stage (apenas automações com trigger_config->>'stage_id' = NEW.status)
    INSERT INTO automation_runs (automation_id, organization_id, trigger_type, context)
    SELECT id, organization_id, 'lead_created_in_stage',
           jsonb_build_object(
             'deal_id', NEW.id,
             'contact_id', NEW.contact_id,
             'stage_id', NEW.status
           )
    FROM automations
    WHERE active = true
      AND organization_id = NEW.organization_id
      AND trigger_type = 'lead_created_in_stage'
      AND (trigger_config->>'stage_id') = NEW.status::text;

    RETURN NEW;
  END IF;

  -- ── UPDATE ──
  IF TG_OP = 'UPDATE' THEN
    -- stage_changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM fn_queue_automation_runs(
        NEW.organization_id, 'stage_changed',
        jsonb_build_object(
          'deal_id', NEW.id,
          'contact_id', NEW.contact_id,
          'from_stage_id', OLD.status,
          'to_stage_id', NEW.status
        )
      );
    END IF;

    -- owner_changed
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      PERFORM fn_queue_automation_runs(
        NEW.organization_id, 'owner_changed',
        jsonb_build_object(
          'deal_id', NEW.id,
          'contact_id', NEW.contact_id,
          'old_owner_id', OLD.owner_id,
          'new_owner_id', NEW.owner_id
        )
      );
    END IF;

    -- deal_won
    IF (OLD.is_won IS DISTINCT FROM NEW.is_won) AND NEW.is_won = true THEN
      PERFORM fn_queue_automation_runs(
        NEW.organization_id, 'deal_won',
        jsonb_build_object('deal_id', NEW.id, 'contact_id', NEW.contact_id)
      );
    END IF;

    -- deal_lost
    IF (OLD.is_lost IS DISTINCT FROM NEW.is_lost) AND NEW.is_lost = true THEN
      PERFORM fn_queue_automation_runs(
        NEW.organization_id, 'deal_lost',
        jsonb_build_object('deal_id', NEW.id, 'contact_id', NEW.contact_id)
      );
    END IF;

    -- custom_field_updated
    IF OLD.custom_fields IS DISTINCT FROM NEW.custom_fields THEN
      PERFORM fn_queue_automation_runs(
        NEW.organization_id, 'custom_field_updated',
        jsonb_build_object(
          'deal_id', NEW.id,
          'contact_id', NEW.contact_id,
          'old_fields', OLD.custom_fields,
          'new_fields', NEW.custom_fields
        )
      );
    END IF;

    -- tag_added: tags em NEW mas não em OLD
    IF OLD.tags IS DISTINCT FROM NEW.tags THEN
      FOR added_tag IN
        SELECT t FROM unnest(COALESCE(NEW.tags, '{}')) t
        WHERE NOT (t = ANY(COALESCE(OLD.tags, '{}')))
      LOOP
        PERFORM fn_queue_automation_runs(
          NEW.organization_id, 'tag_added',
          jsonb_build_object(
            'deal_id', NEW.id,
            'contact_id', NEW.contact_id,
            'tag', added_tag
          )
        );
      END LOOP;

      -- tag_removed: tags em OLD mas não em NEW
      FOR removed_tag IN
        SELECT t FROM unnest(COALESCE(OLD.tags, '{}')) t
        WHERE NOT (t = ANY(COALESCE(NEW.tags, '{}')))
      LOOP
        PERFORM fn_queue_automation_runs(
          NEW.organization_id, 'tag_removed',
          jsonb_build_object(
            'deal_id', NEW.id,
            'contact_id', NEW.contact_id,
            'tag', removed_tag
          )
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_automation_trigger ON deals;
CREATE TRIGGER deals_automation_trigger
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION trg_deals_automation();

-- ──────────────────────────────────────────────────────────────
-- Gatilho: messages → message_received, message_sent
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_messages_automation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id   uuid;
  v_contact  uuid;
BEGIN
  -- Busca org_id e contact_id via chat_session
  SELECT cs.organization_id, cs.contact_id
    INTO v_org_id, v_contact
    FROM chat_sessions cs
   WHERE cs.id = NEW.session_id
   LIMIT 1;

  IF v_org_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.from_me = false THEN
    PERFORM fn_queue_automation_runs(
      v_org_id, 'message_received',
      jsonb_build_object(
        'session_id', NEW.session_id,
        'message_id', NEW.id,
        'contact_id', v_contact,
        'content', NEW.content
      )
    );
  ELSE
    PERFORM fn_queue_automation_runs(
      v_org_id, 'message_sent',
      jsonb_build_object(
        'session_id', NEW.session_id,
        'message_id', NEW.id,
        'contact_id', v_contact
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_automation_trigger ON messages;
CREATE TRIGGER messages_automation_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION trg_messages_automation();

-- ──────────────────────────────────────────────────────────────
-- Gatilho: chat_sessions → chat_initiated
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_chat_sessions_automation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM fn_queue_automation_runs(
    NEW.organization_id, 'chat_initiated',
    jsonb_build_object(
      'session_id', NEW.id,
      'contact_id', NEW.contact_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_sessions_automation_trigger ON chat_sessions;
CREATE TRIGGER chat_sessions_automation_trigger
  AFTER INSERT ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION trg_chat_sessions_automation();

-- ──────────────────────────────────────────────────────────────
-- pg_cron: dispara automation-engine a cada 1 minuto
-- ──────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'automation-engine-tick',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/automation-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'
    );
  $$
);
