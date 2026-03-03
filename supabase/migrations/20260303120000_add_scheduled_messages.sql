-- ============================================================
-- Sprint 4 - TASK-12: Agendamento de Mensagens
-- Cria a tabela scheduled_messages para guardar mensagens
-- que devem ser enviadas em horário futuro via WhatsApp.
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content         text NOT NULL,
  -- Variáveis dinâmicas ex: {{nome}}, {{data}} - substituídas no envio
  has_variables   boolean DEFAULT false,
  scheduled_at    timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at         timestamptz,
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_org ON scheduled_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_at ON scheduled_messages(scheduled_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_messages_org_isolation" ON scheduled_messages
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_scheduled_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION update_scheduled_messages_updated_at();

-- ============================================================
-- pg_cron: Disparo automático a cada 1 minuto
-- Requer extensão pg_cron habilitada no painel Supabase.
-- Ativa a Edge Function 'send-scheduled-messages' periodicamente.
-- ============================================================
SELECT cron.schedule(
  'process-scheduled-messages',   -- nome único do job
  '* * * * *',                     -- a cada 1 minuto
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-scheduled-messages',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'
    );
  $$
);
