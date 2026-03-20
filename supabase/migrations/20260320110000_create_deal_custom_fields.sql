-- Migration: Tabela de definições de campos personalizados para deals
-- Os valores são armazenados em deals.custom_fields (jsonb já existente)
-- Esta tabela persiste as *definições* (antes ficavam em localStorage)

CREATE TABLE IF NOT EXISTS deal_custom_fields (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid       NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label          text        NOT NULL,
  field_key      text        NOT NULL,   -- identificador camelCase usado como chave no jsonb
  field_type     text        NOT NULL DEFAULT 'text', -- text | number | date | select | boolean | url
  options        jsonb,                  -- array de strings para tipo 'select'
  sort_order     integer     DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(organization_id, field_key)
);

ALTER TABLE deal_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view deal fields"
  ON deal_custom_fields FOR SELECT
  USING (organization_id = get_auth_organization_id());

CREATE POLICY "Org members can insert deal fields"
  ON deal_custom_fields FOR INSERT
  WITH CHECK (organization_id = get_auth_organization_id());

CREATE POLICY "Org members can update deal fields"
  ON deal_custom_fields FOR UPDATE
  USING (organization_id = get_auth_organization_id());

CREATE POLICY "Org members can delete deal fields"
  ON deal_custom_fields FOR DELETE
  USING (organization_id = get_auth_organization_id());
