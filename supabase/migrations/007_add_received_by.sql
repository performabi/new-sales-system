-- =============================================
-- Goods-In receiver allocation
-- Run this in the Supabase SQL console once per tenant
-- (public.tenants -> schema_name). Example:
--   SET search_path TO tenant_231a006984ed4984bb126ae7fad947c0;
--   ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_by uuid;
-- =============================================

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_by uuid;