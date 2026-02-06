-- Migration: Advanced Chat Features (Reply, Unread Status)
-- DATE: 2026-02-06

-- 1. Add reply_to_message_id to messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id);

-- 2. Add is_marked_unread to chat_sessions
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS is_marked_unread BOOLEAN DEFAULT FALSE;
