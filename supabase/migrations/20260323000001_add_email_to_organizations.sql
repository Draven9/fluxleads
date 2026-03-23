-- Add email contact field to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS email TEXT;
