-- =============================================
-- Clear All Data (keeps schema structure)
-- Truncates all tenant schemas + public tables
-- WARNING: This deletes ALL data irreversibly
-- =============================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Clear each tenant schema
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

  -- Clear public shared tables
  TRUNCATE TABLE
    public.tenant_subscriptions,
    public.tenants,
    public.super_users,
    public.plans
  CASCADE;
END;
$$;
