-- Migration: Add name column to chat_sessions + sender info to messages
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/mptfksxpsqoztyxmbwkq/sql

-- 1. Chat sessions: display name (group name or contact override)
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Messages: sender info for group messages (who sent in the group)
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS sender_name TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS sender_phone TEXT;

-- 3. Backfill: tag existing group sessions with a JID-extracted placeholder
-- (they will be updated with real names when next message arrives)
UPDATE public.chat_sessions
SET name = regexp_replace(provider_id, '@.*', '')
WHERE name IS NULL
  AND provider_id LIKE '%@g.us%';
