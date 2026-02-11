-- Migration: Harden Chat RLS Policies
-- DATE: 2026-02-07
-- PURPOSE: Replace JWT-based RLS with strict database-level organization isolation using public.get_auth_organization_id().

-- =============================================================================
-- 1. CHAT SESSIONS
-- =============================================================================

-- Drop old policies (if they exist with these names or auto-generated ones)
DROP POLICY IF EXISTS "Users can view sessions in their org" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert sessions in their org" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update sessions in their org" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete sessions in their org" ON public.chat_sessions;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.chat_sessions;

-- Create new strict policies
CREATE POLICY "Users can view sessions in their org"
ON public.chat_sessions FOR SELECT
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can insert sessions in their org"
ON public.chat_sessions FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can update sessions in their org"
ON public.chat_sessions FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can delete sessions in their org"
ON public.chat_sessions FOR DELETE
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 2. MESSAGES
-- =============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view messages in their org" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in their org" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages in their org" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages in their org" ON public.messages;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.messages;

-- Create new strict policies
CREATE POLICY "Users can view messages in their org"
ON public.messages FOR SELECT
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can insert messages in their org"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can update messages in their org"
ON public.messages FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
)
WITH CHECK (
  organization_id = public.get_auth_organization_id()
);

CREATE POLICY "Users can delete messages in their org"
ON public.messages FOR DELETE
TO authenticated
USING (
  organization_id = public.get_auth_organization_id()
);

-- =============================================================================
-- 3. CHAT PARTICIPANTS (If exists)
-- =============================================================================
-- Check if table exists before applying policies to avoid errors if it wasn't created yet
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_participants') THEN
        
        DROP POLICY IF EXISTS "Users can view participants in their org" ON public.chat_participants;
        DROP POLICY IF EXISTS "Users can insert participants in their org" ON public.chat_participants;
        DROP POLICY IF EXISTS "Users can update participants in their org" ON public.chat_participants;
        DROP POLICY IF EXISTS "Users can delete participants in their org" ON public.chat_participants;

        CREATE POLICY "Users can view participants in their org"
        ON public.chat_participants FOR SELECT
        TO authenticated
        USING (
          organization_id = public.get_auth_organization_id()
        );

        CREATE POLICY "Users can insert participants in their org"
        ON public.chat_participants FOR INSERT
        TO authenticated
        WITH CHECK (
          organization_id = public.get_auth_organization_id()
        );

        CREATE POLICY "Users can update participants in their org"
        ON public.chat_participants FOR UPDATE
        TO authenticated
        USING (
          organization_id = public.get_auth_organization_id()
        )
        WITH CHECK (
          organization_id = public.get_auth_organization_id()
        );
        
        CREATE POLICY "Users can delete participants in their org"
        ON public.chat_participants FOR DELETE
        TO authenticated
        USING (
          organization_id = public.get_auth_organization_id()
        );

    END IF;
END
$$;
