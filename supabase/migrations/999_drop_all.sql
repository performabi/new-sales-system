-- =============================================
-- Drop Everything (schema + data)
-- Drops all tenant schemas + public tables
-- WARNING: This destroys ALL data irreversibly
-- =============================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Drop each tenant schema (cascades to all their tables)
  FOR rec IN SELECT schema_name FROM public.tenants WHERE schema_name IS NOT NULL LOOP
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', rec.schema_name);
  END LOOP;

  -- Drop public tables
  DROP TABLE IF EXISTS public.tenant_subscriptions CASCADE;
  DROP TABLE IF EXISTS public.tenants CASCADE;
  DROP TABLE IF EXISTS public.super_users CASCADE;
  DROP TABLE IF EXISTS public.plans CASCADE;

  -- Drop helper function
  DROP FUNCTION IF EXISTS public.exec_sql(TEXT);
  DROP FUNCTION IF EXISTS public.provision_tenant(TEXT, TEXT, UUID);
END;
$$;
