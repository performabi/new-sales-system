-- =============================================
-- JGS Sales & Stock System — Database Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. STORES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS stores (
  store_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  address    TEXT NOT NULL,
  postcode   VARCHAR(20) NOT NULL,
  vat_number VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username          VARCHAR(50) UNIQUE NOT NULL,
  pin_hash          TEXT NOT NULL,
  full_name         VARCHAR(255) NOT NULL,
  role              VARCHAR(20) NOT NULL CHECK (role IN ('super_user', 'admin', 'user')),
  is_active         BOOLEAN DEFAULT true,
  assigned_store_id UUID REFERENCES stores(store_id) ON DELETE SET NULL
);

-- =============================================
-- 3. INVENTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS inventory (
  product_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL DEFAULT 'Unnamed Product',
  barcode_qr     VARCHAR(100),
  stock_quantity INTEGER DEFAULT 0,
  price          DECIMAL(12, 2) NOT NULL
);

-- Index on barcode for scanner lookups
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode_qr);

-- =============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE stores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE user_id = auth.uid();
$$;

-- Helper function to get current user's assigned store
CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_store_id FROM users WHERE user_id = auth.uid();
$$;

-- ----- STORES policies -----

CREATE POLICY "stores_admin_full_access" ON stores
  FOR ALL
  USING ( public.get_user_role() IN ('super_user', 'admin') )
  WITH CHECK ( public.get_user_role() IN ('super_user', 'admin') );

CREATE POLICY "stores_user_read_own" ON stores
  FOR SELECT
  USING ( store_id = public.get_user_store_id() );

-- ----- USERS policies -----

CREATE POLICY "users_superuser_full_access" ON users
  FOR ALL
  USING ( public.get_user_role() = 'super_user' )
  WITH CHECK ( public.get_user_role() = 'super_user' );

CREATE POLICY "users_admin_manage" ON users
  FOR ALL
  USING ( public.get_user_role() = 'admin' AND role != 'super_user' )
  WITH CHECK ( public.get_user_role() = 'admin' AND role != 'super_user' );

CREATE POLICY "users_read_self" ON users
  FOR SELECT
  USING ( user_id = auth.uid() );

-- ----- INVENTORY policies -----

CREATE POLICY "inventory_admin_full_access" ON inventory
  FOR ALL
  USING ( public.get_user_role() IN ('super_user', 'admin') )
  WITH CHECK ( public.get_user_role() IN ('super_user', 'admin') );

CREATE POLICY "inventory_user_read_own" ON inventory
  FOR SELECT
  USING ( store_id = public.get_user_store_id() );

-- =============================================
-- 5. SERVICE ROLE BYPASS (for API middleware)
-- =============================================
-- The service_role key bypasses RLS automatically.
-- No additional config needed — just use the service
-- role key in your server-side API calls.
