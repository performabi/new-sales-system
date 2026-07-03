-- =============================================
-- Migration 006: Add created_by / created_at tracking
-- Run this in the Supabase SQL Editor
-- =============================================

-- Add created_by to stores (references users table)
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- Add created_by to plu (references users table)
ALTER TABLE plu
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- Add created_at and created_by to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(user_id) ON DELETE SET NULL;
