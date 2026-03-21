-- Torna session_id nullable para permitir agendamento sem conversa ativa
ALTER TABLE scheduled_messages
  ALTER COLUMN session_id DROP NOT NULL;

-- Adiciona deal_id para vincular agendamento diretamente ao negócio
ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id) ON DELETE SET NULL;

-- Índice para busca por contact_id (agendamentos sem sessão)
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_contact_id
  ON scheduled_messages (contact_id)
  WHERE status = 'pending';

-- Índice para busca por deal_id
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_deal_id
  ON scheduled_messages (deal_id)
  WHERE status = 'pending';
