-- =============================================================================
-- MIGRATION: 20260205120000_harden_rls_policies.sql
-- PURPOSE: Replace permissive "USING (true)" policies with strict organization isolation.
-- AUTHOR: Antigravity Agent
-- =============================================================================

-- HELPER FUNCTION: Get current user's organization_id
-- This avoids repetitive subqueries and potential recursion issues.
CREATE OR REPLACE FUNCTION public.get_auth_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 1. ORGANIZATIONS
-- Users can only see their own organization.
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;

CREATE POLICY "Users can view own organization"
ON public.organizations FOR SELECT
TO authenticated
USING (
  id = public.get_auth_organization_id()
);

-- =============================================================================
-- 2. PROFILES
-- Users can see all profiles within their organization (to collaborate).
-- Users can update only their own profile.
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in own org" ON public.profiles;

CREATE POLICY "Users can view profiles in own org"
ON public.profiles FOR SELECT
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
);

-- =============================================================================
-- 3. CRM_COMPANIES
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.crm_companies;

CREATE POLICY "Users can view companies in own org"
ON public.crm_companies FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 4. CONTACTS
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.contacts;

CREATE POLICY "Users can view contacts in own org"
ON public.contacts FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 5. DEALS
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.deals;

CREATE POLICY "Users can view deals in own org"
ON public.deals FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 6. DEAL_ITEMS
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.deal_items;

CREATE POLICY "Users can view deal items in own org"
ON public.deal_items FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 7. ACTIVITIES
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.activities;

CREATE POLICY "Users can view activities in own org"
ON public.activities FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 8. PRODUCTS
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.products;

CREATE POLICY "Users can view products in own org"
ON public.products FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 9. BOARDS & STAGES
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.boards;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.board_stages;

CREATE POLICY "Users can view boards in own org"
ON public.boards FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can view board stages in own org"
ON public.board_stages FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 10. TAGS & CUSTOM FIELDS
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.tags;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.custom_field_definitions;

CREATE POLICY "Users can view tags in own org"
ON public.tags FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can view custom fields in own org"
ON public.custom_field_definitions FOR ALL
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);
