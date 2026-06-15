-- Add email column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
