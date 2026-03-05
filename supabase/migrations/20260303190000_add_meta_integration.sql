-- =============================================================================
-- MIGRATION: ADD META INTEGRATION TABLES
-- Purpose: Store FB/IG tokens and social comments
-- =============================================================================

-- 1. Configuration for Meta per Organization (Admin setup)
CREATE TABLE IF NOT EXISTS public.organization_meta_configs (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  meta_app_id TEXT,
  meta_app_secret TEXT,
  meta_verify_token TEXT,
  facebook_page_id TEXT,
  facebook_access_token TEXT,
  instagram_account_id TEXT,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_meta_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage meta configs" ON public.organization_meta_configs
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = organization_meta_configs.organization_id
      AND role = 'admin'
    )
  );

-- 2. Social Comments separate from direct messages CRM
CREATE TABLE IF NOT EXISTS public.social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('instagram', 'facebook')),
  external_comment_id TEXT NOT NULL,
  external_post_id TEXT NOT NULL,
  external_from_id TEXT NOT NULL,
  from_name TEXT,
  content TEXT,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'replied', 'ignored', 'lead_created')),
  created_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS social_comments_external_id_idx 
  ON public.social_comments(external_comment_id);

ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;

-- Allow regular users to interact with comments from their org
CREATE POLICY "Users can view social comments in their org" ON public.social_comments
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert social comments in their org" ON public.social_comments
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update social comments in their org" ON public.social_comments
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_comments;
