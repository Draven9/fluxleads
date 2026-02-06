-- Add missing columns for WhatsApp Integration
alter table integration_inbound_sources add column if not exists type text;
alter table integration_inbound_sources add column if not exists configuration jsonb default '{}'::jsonb;
