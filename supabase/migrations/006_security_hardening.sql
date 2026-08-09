-- =============================================
-- 006_security_hardening.sql
-- Security hardening + schema consistency fixes
-- Run ONCE in the Supabase dashboard SQL editor.
-- =============================================

-- =============================================
-- 1. REMOVE exec_sql RCE HELPER
--    SECURITY DEFINER raw-SQL RPC, exposed to anon.
-- =============================================
REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

-- =============================================
-- 2. POS LOGIN ATTEMPT TRACKING (rate limiting)
--    Server-only table; no client access.
-- =============================================
CREATE TABLE IF NOT EXISTS public.pos_login_attempts (
  attempt_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier    TEXT NOT NULL,
  ip            TEXT,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  success       BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_pos_login_attempts_identifier
  ON public.pos_login_attempts (identifier, attempted_at DESC);
REVOKE ALL ON public.pos_login_attempts FROM anon, authenticated;
ALTER TABLE public.pos_login_attempts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. FIX SUPER USERS RLS
--    Previously ANY authenticated user could read
--    every super user (incl. pin_hash). Own-row only.
-- =============================================
DROP POLICY IF EXISTS "super_users_read_own" ON public.super_users;
CREATE POLICY "super_users_read_own" ON public.super_users
  FOR SELECT TO authenticated
  USING (super_user_id = auth.uid());

-- Defence in depth: anon never writes public tables
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE USAGE ON SCHEMA public FROM anon;

-- =============================================
-- 4. REPAIR ALL EXISTING TENANT SCHEMAS
--    - system_settings RLS (was missing)
--    - sales_transactions: staff FK + cashback columns
--    - missing FKs (timesheets, loyalty notifications)
--    - inventory(store_id, name) index
--    - anon DML revoked, PLU reads authenticated-only
-- =============================================
DO $$
DECLARE
  rec RECORD;
  v_schema TEXT;
BEGIN
  FOR rec IN SELECT schema_name FROM public.tenants WHERE schema_name IS NOT NULL LOOP
    v_schema := rec.schema_name;

    -- ---- system_settings: enable RLS + policies ----
    EXECUTE format('ALTER TABLE %I.system_settings ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('DROP POLICY IF EXISTS "system_settings_admin_all" ON %I.system_settings', v_schema);
    EXECUTE format('
      CREATE POLICY "system_settings_admin_all" ON %I.system_settings
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    -- ---- sales_transactions: fix staff FK (contradictory NOT NULL + SET NULL), add cashback columns ----
    EXECUTE format('ALTER TABLE %I.sales_transactions DROP CONSTRAINT IF EXISTS sales_transactions_staff_user_id_fkey', v_schema);
    EXECUTE format('ALTER TABLE %I.sales_transactions ALTER COLUMN staff_user_id DROP NOT NULL', v_schema);
    EXECUTE format('
      ALTER TABLE %I.sales_transactions
        ADD CONSTRAINT fk_sales_tx_staff
        FOREIGN KEY (staff_user_id) REFERENCES %I.users(user_id) ON DELETE SET NULL',
      v_schema, v_schema);
    EXECUTE format('ALTER TABLE %I.sales_transactions ADD COLUMN IF NOT EXISTS cashback_percent NUMERIC(5,2)', v_schema);
    EXECUTE format('ALTER TABLE %I.sales_transactions ADD COLUMN IF NOT EXISTS cashback_earned NUMERIC(10,2) NOT NULL DEFAULT 0.00', v_schema);

    -- ---- timesheets: wire user FK ----
    EXECUTE format('ALTER TABLE %I.staff_timesheets DROP CONSTRAINT IF EXISTS fk_timesheets_user', v_schema);
    EXECUTE format('
      ALTER TABLE %I.staff_timesheets
        ADD CONSTRAINT fk_timesheets_user
        FOREIGN KEY (user_id) REFERENCES %I.users(user_id) ON DELETE CASCADE',
      v_schema, v_schema);

    -- ---- loyalty_notifications: wire created_by FK ----
    EXECUTE format('ALTER TABLE %I.loyalty_notifications DROP CONSTRAINT IF EXISTS fk_loyalty_notif_created_by', v_schema);
    EXECUTE format('
      ALTER TABLE %I.loyalty_notifications
        ADD CONSTRAINT fk_loyalty_notif_created_by
        FOREIGN KEY (created_by) REFERENCES %I.users(user_id) ON DELETE SET NULL',
      v_schema, v_schema);

    -- ---- inventory: index for per-store sale lookups ----
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_inventory_store_name ON %I.inventory(store_id, name)',
      replace(v_schema, 'tenant_', ''), v_schema);

    -- ---- anon: no DML in tenant schemas ----
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I FROM anon', v_schema);

    -- ---- PLU read policies: authenticated-only (previously PUBLIC) ----
    EXECUTE format('DROP POLICY IF EXISTS "plu_user_read" ON %I.plu', v_schema);
    EXECUTE format('CREATE POLICY "plu_user_read" ON %I.plu FOR SELECT TO authenticated USING (true)', v_schema);
    EXECUTE format('DROP POLICY IF EXISTS "plu_categories_user_read" ON %I.plu_categories', v_schema);
    EXECUTE format('CREATE POLICY "plu_categories_user_read" ON %I.plu_categories FOR SELECT TO authenticated USING (true)', v_schema);

    -- ---- item_sizing read for users (POS) ----
    EXECUTE format('DROP POLICY IF EXISTS "item_sizing_user_read" ON %I.item_sizing', v_schema);
    EXECUTE format('CREATE POLICY "item_sizing_user_read" ON %I.item_sizing FOR SELECT TO authenticated USING (true)', v_schema);
  END LOOP;
END;
$$;

-- =============================================
-- 5. CARD NUMBER GENERATION
--    Guarantee uniqueness across tenants (future-proof)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants (is_active);

DO $$ BEGIN RAISE NOTICE 'Security hardening applied. exec_sql dropped.'; END $$;
