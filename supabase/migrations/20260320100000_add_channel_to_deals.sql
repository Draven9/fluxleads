-- Add channel field to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS channel text;
