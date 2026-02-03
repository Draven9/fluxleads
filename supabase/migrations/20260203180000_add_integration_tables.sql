-- =============================================================================
-- MIGRATION: ADD MISSING INTEGRATION TABLES
-- Purpose: Fix "Could not find the table 'public.integration_inbound_sources'" error
-- =============================================================================

-- 1. Config: fontes inbound (admin-only)
CREATE TABLE IF NOT EXISTS public.integration_inbound_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Entrada de Leads',
  entry_board_id UUID NOT NULL REFERENCES public.boards(id),
  entry_stage_id UUID NOT NULL REFERENCES public.board_stages(id),
  secret TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.integration_inbound_sources ENABLE ROW LEVEL SECURITY;

-- 2. Config: endpoints outbound (admin-only)
CREATE TABLE IF NOT EXISTS public.integration_outbound_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Follow-up (Webhook)',
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['deal.stage_changed'],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.integration_outbound_endpoints ENABLE ROW LEVEL SECURITY;

-- 3. Auditoria mínima: inbound events
CREATE TABLE IF NOT EXISTS public.webhook_events_in (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.integration_inbound_sources(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'generic',
  external_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  created_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_events_in ENABLE ROW LEVEL SECURITY;

-- Dedupe inbound quando existir external_event_id
CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_in_dedupe
  ON public.webhook_events_in(source_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

-- 4. Auditoria mínima: outbound events
CREATE TABLE IF NOT EXISTS public.webhook_events_out (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  from_stage_id UUID REFERENCES public.board_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES public.board_stages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_events_out ENABLE ROW LEVEL SECURITY;

-- 5. Auditoria mínima: deliveries
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES public.integration_outbound_endpoints(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.webhook_events_out(id) ON DELETE CASCADE,
  request_id BIGINT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_status INT,
  error TEXT
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES (Simple admin access for now)

-- integration_inbound_sources
CREATE POLICY "Admins can manage inbound sources" ON public.integration_inbound_sources
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = integration_inbound_sources.organization_id
      AND role = 'admin'
    )
  );

-- integration_outbound_endpoints
CREATE POLICY "Admins can manage outbound endpoints" ON public.integration_outbound_endpoints
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE organization_id = integration_outbound_endpoints.organization_id
      AND role = 'admin'
    )
  );
