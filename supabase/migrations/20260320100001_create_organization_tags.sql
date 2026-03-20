-- Create organization_tags table for centralized tag management
CREATE TABLE IF NOT EXISTS organization_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE organization_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view tags"
  ON organization_tags FOR SELECT
  USING (organization_id = get_auth_organization_id());

CREATE POLICY "Org members can insert tags"
  ON organization_tags FOR INSERT
  WITH CHECK (organization_id = get_auth_organization_id());

CREATE POLICY "Org members can update tags"
  ON organization_tags FOR UPDATE
  USING (organization_id = get_auth_organization_id());

CREATE POLICY "Org members can delete tags"
  ON organization_tags FOR DELETE
  USING (organization_id = get_auth_organization_id());
