-- =============================================
-- Goods-In receiver allocation: received_by column
-- Run this ONCE in the Supabase SQL console (no per-tenant edits needed).
-- Adds the column to purchase_orders in every active tenant schema.
-- =============================================

DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN SELECT schema_name FROM public.tenants WHERE is_active = true LOOP
    EXECUTE format('ALTER TABLE %I.purchase_orders ADD COLUMN IF NOT EXISTS received_by uuid', s);
    RAISE NOTICE 'added received_by to %', s;
  END LOOP;
END $$;