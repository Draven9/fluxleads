-- Adiciona message_direction ao context das runs de mensagem
-- para permitir condições de "mensagem recebida" vs "mensagem enviada"

CREATE OR REPLACE FUNCTION trg_messages_automation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id  uuid;
  v_contact uuid;
BEGIN
  SELECT cs.organization_id, cs.contact_id INTO v_org_id, v_contact
    FROM chat_sessions cs WHERE cs.id = NEW.session_id LIMIT 1;
  IF v_org_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.from_me = false THEN
    PERFORM fn_queue_automation_runs(v_org_id, 'message_received',
      jsonb_build_object(
        'session_id', NEW.session_id,
        'message_id', NEW.id,
        'contact_id', v_contact,
        'content', NEW.content,
        'message_direction', 'received'
      ));
  ELSE
    PERFORM fn_queue_automation_runs(v_org_id, 'message_sent',
      jsonb_build_object(
        'session_id', NEW.session_id,
        'message_id', NEW.id,
        'contact_id', v_contact,
        'content', NEW.content,
        'message_direction', 'sent'
      ));
  END IF;

  RETURN NEW;
END;
$$;
