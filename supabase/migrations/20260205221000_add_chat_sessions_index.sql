-- Add Unique Index for Chat Sessions Upsert support
create unique index if not exists chat_sessions_org_contact_idx on chat_sessions (organization_id, contact_id);
