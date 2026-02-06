-- Migration: Enable Message Deletion for Admins
-- DATE: 2026-02-06

-- Policy: Allow DELETE on messages table
-- Restriction: Only for 'admin' or 'owner' roles within the same organization

CREATE POLICY "Admins can delete messages in their org" ON public.messages
  FOR DELETE USING (
    -- Must belong to the user's organization (Tenant isolation)
    organization_id = (auth.jwt() ->> 'organization_id')
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
