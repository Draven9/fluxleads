-- Adiciona coluna from_me à tabela messages como coluna gerada
-- derivada de direction. Necessário para o trigger trg_messages_automation
-- que referencia NEW.from_me para disparar automações.
-- direction='outbound' → from_me=true (mensagem enviada pela equipe)
-- direction='inbound'  → from_me=false (mensagem recebida do contato)

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS from_me boolean
    GENERATED ALWAYS AS (direction = 'outbound') STORED;
