-- FASE 5.3 — Permissões Granulares por Papel de Usuário
-- Adiciona coluna JSONB `permissions` na tabela `profiles` com flags granulares.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
        "can_delete_deals": false,
        "can_export_data": false,
        "can_view_all_deals": false,
        "can_manage_automations": false,
        "can_view_reports": true,
        "can_manage_tags": true,
        "can_manage_products": false
    }';

-- Admins recebem todas as permissões por padrão
UPDATE public.profiles
SET permissions = '{
    "can_delete_deals": true,
    "can_export_data": true,
    "can_view_all_deals": true,
    "can_manage_automations": true,
    "can_view_reports": true,
    "can_manage_tags": true,
    "can_manage_products": true
}'
WHERE role = 'admin' AND (permissions = '{}' OR permissions IS NULL OR permissions = '{
        "can_delete_deals": false,
        "can_export_data": false,
        "can_view_all_deals": false,
        "can_manage_automations": false,
        "can_view_reports": true,
        "can_manage_tags": true,
        "can_manage_products": false
    }');

-- Índice para buscas por permissão específica (opcional, performance)
CREATE INDEX IF NOT EXISTS idx_profiles_permissions
    ON public.profiles USING gin(permissions);
