-- =============================================================================
-- AI PROMPTS: Override / versioning por organização
-- Generated at: 2025-12-25
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_org_key ON public.ai_prompt_templates(organization_id, key);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_org_key_active ON public.ai_prompt_templates(organization_id, key, is_active);

-- Uma versão por key/organization
CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_templates_org_key_version_unique
  ON public.ai_prompt_templates(organization_id, key, version);

-- Apenas um "active" por key/organization
CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_templates_org_key_active_unique
  ON public.ai_prompt_templates(organization_id, key)
  WHERE is_active;

-- Policies (espelham organization_settings)
DROP POLICY IF EXISTS "Admins can manage ai prompts" ON public.ai_prompt_templates;
CREATE POLICY "Admins can manage ai prompts"
  ON public.ai_prompt_templates
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = ai_prompt_templates.organization_id
      AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = ai_prompt_templates.organization_id
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Members can view ai prompts" ON public.ai_prompt_templates;
CREATE POLICY "Members can view ai prompts"
  ON public.ai_prompt_templates
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = ai_prompt_templates.organization_id
    )
  );

