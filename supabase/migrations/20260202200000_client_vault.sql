-- =============================================================================
-- CLIENT VAULT & ACTIVE CLIENTS FEATURES
-- =============================================================================

-- 1. Add Status to CRM Companies (Carteira vs Leads)
ALTER TABLE public.crm_companies
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CHURNED', 'INACTIVE'));

CREATE INDEX IF NOT EXISTS idx_crm_companies_status ON public.crm_companies(status);

-- 2. Client Vault Items (Credenciais e Acessos)
CREATE TABLE IF NOT EXISTS public.client_vault_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_company_id UUID NOT NULL REFERENCES public.crm_companies(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL DEFAULT 'LOGIN' CHECK (type IN ('LOGIN', 'NOTE', 'SERVER', 'WIFI', 'OTHER')),
    name TEXT NOT NULL, -- "Instagram", "Painel WP"
    
    username TEXT,
    encrypted_password TEXT, -- Armazena o cyphertext (pgcrypto ou client-side)
    url TEXT,
    
    notes TEXT,
    category TEXT, -- "Social Media", "Infra", "Marketing"
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.client_vault_items ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_vault_company ON public.client_vault_items(client_company_id);
CREATE INDEX IF NOT EXISTS idx_client_vault_org ON public.client_vault_items(organization_id);

-- Policies (Simplified for Single Tenant - similar to other tables)
DROP POLICY IF EXISTS "vault_items_access" ON public.client_vault_items;
CREATE POLICY "vault_items_access" ON public.client_vault_items
    FOR ALL TO authenticated
    USING (
        organization_id = (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_vault_items_updated_at ON public.client_vault_items;
CREATE TRIGGER update_vault_items_updated_at
    BEFORE UPDATE ON public.client_vault_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
