-- =============================================
-- 009_po_business_dates.sql
-- Business delivery date on purchase_orders.
-- Run this ONCE in the Supabase SQL console (no per-tenant edits needed).
-- expected_delivery_date already exists (added earlier); this adds the
-- user-editable delivered_date business field, separate from the immutable
-- received_at / created_at audit timestamps (see D6 close-out).
-- =============================================

DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN SELECT schema_name FROM public.tenants WHERE is_active = true LOOP
    EXECUTE format('ALTER TABLE %I.purchase_orders ADD COLUMN IF NOT EXISTS delivered_date DATE', s);

    -- Index the business date used by the reorder-suggestions 8-week lookback
    EXECUTE format($q$
      CREATE INDEX IF NOT EXISTS idx_%s_po_delivered ON %I.purchase_orders(store_id, delivered_date)
    $q$, replace(s, 'tenant_', ''), s);

    RAISE NOTICE 'added delivered_date to %', s;
  END LOOP;
END $$;