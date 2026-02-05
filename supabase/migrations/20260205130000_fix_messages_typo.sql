-- Migration: Fix Typo in messages column
-- Renames messsage_type to message_type

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'messsage_type'
    ) THEN
        ALTER TABLE public.messages RENAME COLUMN messsage_type TO message_type;
    END IF;
END $$;
