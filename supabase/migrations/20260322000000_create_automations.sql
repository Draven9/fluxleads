-- ============================================================
-- Automações: tabelas, índices, RLS
-- ============================================================

-- Tabela principal: definição das automações
CREATE TABLE IF NOT EXISTS automations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  active          boolean NOT NULL DEFAULT false,
  trigger_type    text NOT NULL,
  trigger_config  jsonb NOT NULL DEFAULT '{}',
  nodes           jsonb NOT NULL DEFAULT '[]',
  edges           jsonb NOT NULL DEFAULT '[]',
  run_count       integer NOT NULL DEFAULT 0,
  last_run_at     timestamptz,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automations_org_active
  ON automations (organization_id, trigger_type)
  WHERE active = true;

-- Tabela de fila: runs pendentes e atrasados
CREATE TABLE IF NOT EXISTS automation_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  trigger_type    text NOT NULL,
  context         jsonb NOT NULL DEFAULT '{}',
  current_node_id text,
  status          text NOT NULL DEFAULT 'pending',
  run_at          timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_pending
  ON automation_runs (run_at)
  WHERE status IN ('pending', 'delayed');

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation
  ON automation_runs (automation_id);

-- RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY automations_org_isolation ON automations
  USING (
    organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_runs_org_isolation ON automation_runs
  USING (
    organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- updated_at automático (usa função set_updated_at já existente no banco)
CREATE TRIGGER automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
