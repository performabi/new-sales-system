-- Add is_active flag to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
