-- =============================================================================
-- MIGRATION: 20260303100000_add_contact_custom_fields.sql
-- PURPOSE: Create EAV structure for Contact custom fields and automations
-- =============================================================================

-- 1. Tabela de definição dos campos
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_type text NOT NULL, -- text | boolean | date | select
  options jsonb,            -- Options array for select type
  trigger_action text,      -- Webhook URL for n8n automation
  created_at timestamptz DEFAULT now()
);

-- 2. Tabela de Valores (Entity-Attribute-Value)
CREATE TABLE IF NOT EXISTS public.contact_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, field_id)
);

-- =============================================================================
-- Permissões Padrão
-- =============================================================================
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_custom_values ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Policies: custom_fields
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can manage custom_fields in own org"
ON public.custom_fields FOR ALL
TO authenticated
USING (organization_id = public.get_auth_organization_id())
WITH CHECK (organization_id = public.get_auth_organization_id());

-- -----------------------------------------------------------------------------
-- Policies: contact_custom_values
-- -----------------------------------------------------------------------------
-- Policy checks if the linked contact belongs to the user's organization
CREATE POLICY "Users can manage contact_custom_values in own org"
ON public.contact_custom_values FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_custom_values.contact_id 
    AND c.organization_id = public.get_auth_organization_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_custom_values.contact_id 
    AND c.organization_id = public.get_auth_organization_id()
  )
);
