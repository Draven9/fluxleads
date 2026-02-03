-- =============================================================================
-- MIGRATION: ADD MISSING SYSTEM_NOTIFICATIONS TABLE
-- Purpose: Fix 404 error fetching system notifications
-- =============================================================================

-- 21. SYSTEM_NOTIFICATIONS (Notificações do sistema)
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low')),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- Simple read policy for authenticated users in the org
CREATE POLICY "Users can view their org notifications"
  ON public.system_notifications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = system_notifications.organization_id
    )
  );

-- Admins/System can insert (usually done by triggers or admin functions, keep open for now for versatility)
CREATE POLICY "Admins can insert notifications"
  ON public.system_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = system_notifications.organization_id
      AND role = 'admin'
    )
  );

-- Users can update (read_at)
CREATE POLICY "Users can update their org notifications"
  ON public.system_notifications
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = system_notifications.organization_id
    )
  );
