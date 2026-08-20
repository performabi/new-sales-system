-- =============================================
-- 010_sales_cash.sql
-- Cash drawer fields on sales_transactions.
-- Run this ONCE in the Supabase SQL console (no per-tenant edits needed).
-- Persists the tendered cash amount and the server-computed change due so
-- cash-drawer reconciliation is possible at API level (see D7 close-out).
-- =============================================

DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN SELECT schema_name FROM public.tenants WHERE is_active = true LOOP
    EXECUTE format('ALTER TABLE %I.sales_transactions ADD COLUMN IF NOT EXISTS cash_given NUMERIC(12,2)', s);
    EXECUTE format('ALTER TABLE %I.sales_transactions ADD COLUMN IF NOT EXISTS change_due NUMERIC(12,2)', s);
    RAISE NOTICE 'added cash_given/change_due to %', s;
  END LOOP;
END $$;