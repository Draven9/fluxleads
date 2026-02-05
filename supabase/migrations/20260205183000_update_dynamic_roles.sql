-- =============================================================================
-- MIGRATION: 20260205183000_update_dynamic_roles.sql
-- PURPOSE: Relax role constraints to allow dynamic roles, add display metadata, and seed defaults.
-- AUTHOR: Antigravity Agent
-- =============================================================================

-- 1. Remove strict CHECK constraints on 'role' columns
-- We want to allow any role string defined in organization_role_settings

-- organization_invites
ALTER TABLE public.organization_invites 
DROP CONSTRAINT IF EXISTS organization_invites_role_check;

-- profiles (if exists)
-- Note: 'profiles' usually doesn't have a check constraint by default in Supabase starter, 
-- but if we added one, we should drop it. 
-- We'll try to drop it just in case, ignoring error if it doesn't exist? 
-- Postgres doesn't have "DROP CONSTRAINT IF EXISTS" for non-existent constraints nicely without exact name.
-- We'll assume the standard name 'profiles_role_check' or similar if we created it. 
-- If not created by us, likely no constraint. 
-- Checking previous migrations, we didn't explicitly add one on profiles, only on invites.

-- organization_role_settings
ALTER TABLE public.organization_role_settings 
DROP CONSTRAINT IF EXISTS organization_role_settings_role_check;

-- 2. Add Metadata columns to organization_role_settings
-- We need: label, description, is_active, color_theme

ALTER TABLE public.organization_role_settings
ADD COLUMN IF NOT EXISTS label TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS color_theme TEXT DEFAULT 'slate'; -- amber, primary, slate, blue, red, green

-- 3. Seed Default Roles for ALL Organizations
-- We will insert/update the standard roles: Admin, Vendedor, Gerente, Suporte.

DO $$
DECLARE
    org RECORD;
BEGIN
    FOR org IN SELECT id FROM public.organizations LOOP
        
        -- Admin
        INSERT INTO public.organization_role_settings (organization_id, role, label, description, is_active, color_theme, permissions)
        VALUES (org.id, 'admin', 'Administrador', 'Acesso total a todas as funcionalidades', true, 'amber', '{"view_all_deals": true, "manage_team": true, "manage_billing": true}'::jsonb)
        ON CONFLICT (organization_id, role) DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            color_theme = EXCLUDED.color_theme;

        -- Vendedor
        INSERT INTO public.organization_role_settings (organization_id, role, label, description, is_active, color_theme, permissions)
        VALUES (org.id, 'vendedor', 'Vendedor', 'Acesso a leads e negociações', true, 'primary', '{"view_all_deals": true, "can_export_contacts": false}'::jsonb)
        ON CONFLICT (organization_id, role) DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            color_theme = EXCLUDED.color_theme;

         -- Gerente (NEW)
        INSERT INTO public.organization_role_settings (organization_id, role, label, description, is_active, color_theme, permissions)
        VALUES (org.id, 'gerente', 'Gerente', 'Gestão de equipe e relatórios avançados', true, 'blue', '{"view_all_deals": true, "view_revenue": true, "manage_team": true}'::jsonb)
        ON CONFLICT (organization_id, role) DO NOTHING;

         -- Suporte (NEW)
        INSERT INTO public.organization_role_settings (organization_id, role, label, description, is_active, color_theme, permissions)
        VALUES (org.id, 'suporte', 'Suporte', 'Atendimento ao cliente e resolução de tickets', true, 'slate', '{"view_all_deals": false, "can_export_contacts": false}'::jsonb)
        ON CONFLICT (organization_id, role) DO NOTHING;
        
         -- Colaborador (Update existing if present)
        INSERT INTO public.organization_role_settings (organization_id, role, label, description, is_active, color_theme, permissions)
        VALUES (org.id, 'colaborador', 'Colaborador', 'Acesso limitado para colaboração', true, 'gray', '{"view_all_deals": false}'::jsonb)
        ON CONFLICT (organization_id, role) DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            color_theme = EXCLUDED.color_theme;

    END LOOP;
END $$;
