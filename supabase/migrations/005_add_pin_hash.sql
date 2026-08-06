-- =============================================
-- Add pin_hash column to super_users
-- For environments where super_users was created
-- before the pin_hash column was added to 000_public_tables.sql
-- =============================================

ALTER TABLE public.super_users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
