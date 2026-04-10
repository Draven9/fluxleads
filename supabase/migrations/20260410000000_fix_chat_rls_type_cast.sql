-- =============================================================================
-- FIX: Corrigir incompatibilidade de tipo TEXT vs UUID nas policies RLS
-- DATA: 2026-04-10
-- PROBLEMA:
--   A coluna organization_id em chat_sessions e messages é do tipo TEXT.
--   A função get_auth_organization_id() retorna UUID.
--   PostgreSQL não faz cast implícito TEXT = UUID, gerando o erro:
--   "operator does not exist: text = uuid"
-- SOLUÇÃO:
--   Recriar todas as policies usando cast explícito: get_auth_organization_id()::text
-- =============================================================================

-- ── chat_sessions ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view sessions in their org" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert sessions in their org" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update sessions in their org" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete sessions in their org" ON public.chat_sessions;

CREATE POLICY "Users can view sessions in their org"
ON public.chat_sessions FOR SELECT
TO authenticated
USING (organization_id::text = public.get_auth_organization_id()::text);

CREATE POLICY "Users can insert sessions in their org"
ON public.chat_sessions FOR INSERT
TO authenticated
WITH CHECK (organization_id::text = public.get_auth_organization_id()::text);

CREATE POLICY "Users can update sessions in their org"
ON public.chat_sessions FOR UPDATE
TO authenticated
USING (organization_id::text = public.get_auth_organization_id()::text)
WITH CHECK (organization_id::text = public.get_auth_organization_id()::text);

CREATE POLICY "Users can delete sessions in their org"
ON public.chat_sessions FOR DELETE
TO authenticated
USING (organization_id::text = public.get_auth_organization_id()::text);

-- ── messages ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view messages in their org" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in their org" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages in their org" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages in their org" ON public.messages;

CREATE POLICY "Users can view messages in their org"
ON public.messages FOR SELECT
TO authenticated
USING (organization_id::text = public.get_auth_organization_id()::text);

CREATE POLICY "Users can insert messages in their org"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (organization_id::text = public.get_auth_organization_id()::text);

CREATE POLICY "Users can update messages in their org"
ON public.messages FOR UPDATE
TO authenticated
USING (organization_id::text = public.get_auth_organization_id()::text)
WITH CHECK (organization_id::text = public.get_auth_organization_id()::text);

CREATE POLICY "Users can delete messages in their org"
ON public.messages FOR DELETE
TO authenticated
USING (organization_id::text = public.get_auth_organization_id()::text);
