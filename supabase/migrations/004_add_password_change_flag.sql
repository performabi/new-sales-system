-- Add requires_password_change flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN DEFAULT false;
