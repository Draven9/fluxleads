-- =============================================================================
-- MIGRATION: 20260205123000_add_colaborador_role.sql
-- PURPOSE: Add 'colaborador' role and create permission settings table.
-- AUTHOR: Antigravity Agent
-- =============================================================================

-- 1. Update organization_invites to accept 'colaborador'
ALTER TABLE public.organization_invites 
DROP CONSTRAINT IF EXISTS organization_invites_role_check;

ALTER TABLE public.organization_invites 
ADD CONSTRAINT organization_invites_role_check 
CHECK (role IN ('admin', 'vendedor', 'colaborador'));

-- 2. Create Role Settings table for granular permissions (Fase 3 foundation)
CREATE TABLE IF NOT EXISTS public.organization_role_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('vendedor', 'colaborador')),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, role)
);

ALTER TABLE public.organization_role_settings ENABLE ROW LEVEL SECURITY;

-- 3. RLS for Role Settings

-- Helper function reuse (from previous migration): public.get_auth_organization_id()

DROP POLICY IF EXISTS "Admins can manage role settings" ON public.organization_role_settings;
CREATE POLICY "Admins can manage role settings" 
ON public.organization_role_settings
FOR ALL 
TO authenticated
USING (
    organization_id = public.get_auth_organization_id() AND
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Members can view role settings" ON public.organization_role_settings;
CREATE POLICY "Members can view role settings" 
ON public.organization_role_settings
FOR SELECT 
TO authenticated
USING (
    organization_id = public.get_auth_organization_id()
);

-- 4. Insert default settings for existing roles (Optional but good for UX)
-- We insert default restrictive/permissive rules so the system works out of the box in Fase 3
INSERT INTO public.organization_role_settings (organization_id, role, permissions)
SELECT 
    id as organization_id, 
    'vendedor' as role,
    '{"view_all_deals": true, "can_export_contacts": false, "view_revenue": true}'::jsonb as permissions
FROM public.organizations
ON CONFLICT (organization_id, role) DO NOTHING;

INSERT INTO public.organization_role_settings (organization_id, role, permissions)
SELECT 
    id as organization_id, 
    'colaborador' as role,
    '{"view_all_deals": false, "can_export_contacts": false, "view_revenue": false}'::jsonb as permissions
FROM public.organizations
ON CONFLICT (organization_id, role) DO NOTHING;
