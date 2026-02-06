-- Migration: Enable Chat Session Deletion for Admins
-- DATE: 2026-02-06

-- Policy: Allow DELETE on chat_sessions table
-- Restriction: Only for 'admin' or 'owner' roles within the same organization

CREATE POLICY "Admins can delete sessions in their org" ON public.chat_sessions
  FOR DELETE USING (
    -- Must belong to the user's organization (Tenant isolation)
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
    AND
    -- User must be an Admin or Owner
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
      )
    )
  );
