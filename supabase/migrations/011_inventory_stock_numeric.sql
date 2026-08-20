-- =============================================
-- 011_inventory_stock_numeric.sql
-- Weighted-item stock units (Phase 5).
-- Run this ONCE in the Supabase SQL console (no per-tenant edits needed).
-- Widens stock to fractional kg for uses_scale PLUs and lets POs order/
-- receive fractional quantities end-to-end.
-- =============================================

DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN SELECT schema_name FROM public.tenants WHERE is_active = true LOOP
    EXECUTE format('ALTER TABLE %I.inventory ALTER COLUMN stock_quantity TYPE NUMERIC(12,3)', s);
    EXECUTE format('ALTER TABLE %I.inventory ALTER COLUMN stock_quantity SET DEFAULT 0', s);
    EXECUTE format('ALTER TABLE %I.purchase_order_items ALTER COLUMN quantity_ordered TYPE NUMERIC(12,3)', s);
    EXECUTE format('ALTER TABLE %I.purchase_order_items ALTER COLUMN quantity_received TYPE NUMERIC(12,3)', s);
    EXECUTE format('ALTER TABLE %I.purchase_order_items ALTER COLUMN quantity_received SET DEFAULT 0', s);
    RAISE NOTICE 'widened stock/PO quantities to NUMERIC(12,3) in %', s;
  END LOOP;
END $$;