-- =============================================
-- Reset Tenant Data — Fresh Start
-- Truncates ALL data from every tenant schema
-- Clears tenant registrations + subscriptions
-- PRESERVES super_users  (your team)
-- PRESERVES plans        (pricing tiers)
-- =============================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Step 1: Wipe each tenant schema completely
  FOR rec IN SELECT schema_name FROM public.tenants WHERE schema_name IS NOT NULL LOOP
    EXECUTE format('
      TRUNCATE TABLE
        %I.sale_items,
        %I.sales_transactions,
        %I.loyalty_cards,
        %I.purchase_order_items,
        %I.purchase_orders,
        %I.supplier_products,
        %I.suppliers,
        %I.plu_scheduled_changes,
        %I.logbook,
        %I.plu,
        %I.plu_categories,
        %I.inventory,
        %I.staff_timesheets,
        %I.store_checklists,
        %I.item_sizing,
        %I.stores,
        %I.users,
        %I.loyalty_notifications,
        %I.system_settings
      CASCADE', rec.schema_name, rec.schema_name, rec.schema_name, rec.schema_name,
      rec.schema_name, rec.schema_name, rec.schema_name, rec.schema_name,
      rec.schema_name, rec.schema_name, rec.schema_name, rec.schema_name,
      rec.schema_name, rec.schema_name, rec.schema_name, rec.schema_name,
      rec.schema_name, rec.schema_name, rec.schema_name);
  END LOOP;

  -- Step 2: Clear tenant registrations (keeps super_users + plans)
  TRUNCATE TABLE
    public.tenant_subscriptions,
    public.tenants
  CASCADE;

  RAISE NOTICE 'Reset complete. super_users and plans preserved.';
END;
$$;
