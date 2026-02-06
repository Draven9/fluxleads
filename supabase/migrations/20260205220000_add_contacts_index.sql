-- Add Unique Index for Upsert support
create unique index if not exists contacts_org_phone_idx on contacts (organization_id, phone);
