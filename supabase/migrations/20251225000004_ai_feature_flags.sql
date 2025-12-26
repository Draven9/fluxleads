-- =============================================================================
-- AI FEATURE FLAGS (org-wide): habilitar/desabilitar funções específicas de IA
-- Generated at: 2025-12-25
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS ai_feature_flags_org_key_unique
  ON public.ai_feature_flags(organization_id, key);

CREATE INDEX IF NOT EXISTS idx_ai_feature_flags_org
  ON public.ai_feature_flags(organization_id);

DROP POLICY IF EXISTS "Admins can manage ai feature flags" ON public.ai_feature_flags;
CREATE POLICY "Admins can manage ai feature flags"
  ON public.ai_feature_flags
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = ai_feature_flags.organization_id
      AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = ai_feature_flags.organization_id
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Members can view ai feature flags" ON public.ai_feature_flags;
CREATE POLICY "Members can view ai feature flags"
  ON public.ai_feature_flags
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = ai_feature_flags.organization_id
    )
  );

