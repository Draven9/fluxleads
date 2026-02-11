-- Add missing indexes for chat performance
-- DATE: 2026-02-11

-- Index for fetching messages by session (critical for chat load)
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);

-- Index for fetching replies (critical for threads and history links)
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_message_id ON public.messages(reply_to_message_id);

-- Index for ordering messages by creation date (used in almost all chat queries)
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
