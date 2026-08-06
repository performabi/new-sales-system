-- =============================================
-- Ensure Tenant Schemas — Repair / Audit
-- Loops through all registered tenants and
-- ensures each tenant schema has all 18 tables
-- with correct definitions, indexes, & RLS.
-- Safe to run multiple times (idempotent).
-- =============================================

DO $outer$
DECLARE
  rec RECORD;
  v_schema TEXT;
BEGIN
  FOR rec IN SELECT tenant_id, schema_name FROM public.tenants WHERE schema_name IS NOT NULL LOOP
    v_schema := rec.schema_name;

    -- Create schema if missing
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

    -- =============================================
    -- 1. USERS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.users (
        user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        username               VARCHAR(50) UNIQUE NOT NULL,
        email                  VARCHAR(255),
        pin_hash               TEXT,
        full_name              VARCHAR(255) NOT NULL,
        role                   VARCHAR(20) NOT NULL CHECK (role IN (''super_user'', ''admin'', ''user'')),
        is_active              BOOLEAN DEFAULT true,
        requires_password_change BOOLEAN DEFAULT false,
        assigned_store_id      UUID,
        created_at             TIMESTAMPTZ DEFAULT now(),
        created_by             UUID
      )', v_schema);

    -- =============================================
    -- 2. STORES
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.stores (
        store_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(255) NOT NULL,
        address       TEXT NOT NULL,
        postcode      VARCHAR(20) NOT NULL,
        vat_number    VARCHAR(50) NOT NULL,
        store_number  VARCHAR(10),
        is_active     BOOLEAN DEFAULT true,
        created_by    UUID,
        created_at    TIMESTAMPTZ DEFAULT now()
      )', v_schema);

    -- Wire up FK on users.assigned_store_id if not present
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = v_schema AND table_name = 'users'
        AND constraint_name = 'fk_users_assigned_store'
    ) THEN
      EXECUTE format('
        ALTER TABLE %I.users
          ADD CONSTRAINT fk_users_assigned_store
          FOREIGN KEY (assigned_store_id) REFERENCES %I.stores(store_id) ON DELETE SET NULL',
        v_schema, v_schema);
    END IF;

    -- Wire up FK on users.created_by if not present
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = v_schema AND table_name = 'users'
        AND constraint_name = 'fk_users_created_by'
    ) THEN
      EXECUTE format('
        ALTER TABLE %I.users
          ADD CONSTRAINT fk_users_created_by
          FOREIGN KEY (created_by) REFERENCES %I.users(user_id) ON DELETE SET NULL',
        v_schema, v_schema);
    END IF;

    -- Wire up FK on stores.created_by if not present
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = v_schema AND table_name = 'stores'
        AND constraint_name = 'fk_stores_created_by'
    ) THEN
      EXECUTE format('
        ALTER TABLE %I.stores
          ADD CONSTRAINT fk_stores_created_by
          FOREIGN KEY (created_by) REFERENCES %I.users(user_id) ON DELETE SET NULL',
        v_schema, v_schema);
    END IF;

    -- =============================================
    -- 3. INVENTORY
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.inventory (
        product_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id       UUID NOT NULL REFERENCES %I.stores(store_id) ON DELETE CASCADE,
        name           VARCHAR(255) NOT NULL DEFAULT ''Unnamed Product'',
        barcode_qr     VARCHAR(100),
        stock_quantity INTEGER DEFAULT 0,
        price          DECIMAL(12, 2) NOT NULL
      )', v_schema, v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_inventory_barcode ON %I.inventory(barcode_qr)',
      replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 4. PLU CATEGORIES
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.plu_categories (
        category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        created_at  TIMESTAMPTZ  DEFAULT now(),
        created_by  UUID         REFERENCES auth.users(id) ON DELETE SET NULL
      )', v_schema);

    -- =============================================
    -- 5. PLU
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.plu (
        plu_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plu_number       VARCHAR(50) UNIQUE NOT NULL,
        name             VARCHAR(255) NOT NULL,
        category_id      UUID         REFERENCES %I.plu_categories(category_id) ON DELETE SET NULL,
        vat_class        VARCHAR(20)  NOT NULL DEFAULT ''standard'' CHECK (vat_class IN (''standard'', ''zero_rated'', ''exempt'')),
        uses_scale       BOOLEAN      NOT NULL DEFAULT false,
        ean              VARCHAR(50),
        headoffice_price DECIMAL(12, 2),
        store_001        DECIMAL(12, 2),
        store_002        DECIMAL(12, 2),
        store_003        DECIMAL(12, 2),
        store_004        DECIMAL(12, 2),
        store_005        DECIMAL(12, 2),
        store_006        DECIMAL(12, 2),
        store_007        DECIMAL(12, 2),
        store_008        DECIMAL(12, 2),
        store_009        DECIMAL(12, 2),
        created_at       TIMESTAMPTZ  DEFAULT now(),
        created_by       UUID         REFERENCES auth.users(id) ON DELETE SET NULL
      )', v_schema, v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_plu_number   ON %I.plu(plu_number)', replace(v_schema, 'tenant_', ''), v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_plu_ean      ON %I.plu(ean)', replace(v_schema, 'tenant_', ''), v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_plu_category ON %I.plu(category_id)', replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 6. LOGBOOK
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.logbook (
        id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp     TIMESTAMPTZ   NOT NULL DEFAULT now(),
        entity        TEXT          NOT NULL,
        entity_label  TEXT          NOT NULL,
        field         TEXT          NOT NULL,
        old_value     TEXT,
        new_value     TEXT,
        username      TEXT          NOT NULL,
        action        TEXT          NOT NULL DEFAULT ''edit''
      )', v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_logbook_timestamp ON %I.logbook (timestamp DESC)', replace(v_schema, 'tenant_', ''), v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_logbook_entity    ON %I.logbook (entity)', replace(v_schema, 'tenant_', ''), v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_logbook_action    ON %I.logbook (action)', replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 7. PLU SCHEDULED CHANGES
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.plu_scheduled_changes (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        plu_id          UUID          NOT NULL REFERENCES %I.plu(plu_id) ON DELETE CASCADE,
        payload         JSONB         NOT NULL,
        scheduled_at    TIMESTAMPTZ   NOT NULL,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        created_by      TEXT,
        applied         BOOLEAN       NOT NULL DEFAULT false,
        applied_at      TIMESTAMPTZ
      )', v_schema, v_schema);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS idx_%s_plu_schedule_pending
        ON %I.plu_scheduled_changes (scheduled_at, applied) WHERE applied = false',
      replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 8. SUPPLIERS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.suppliers (
        supplier_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        name               TEXT          NOT NULL UNIQUE,
        contact_email      TEXT          NOT NULL,
        phone              TEXT,
        address            TEXT,
        payment_terms      TEXT,
        vat_number         TEXT,
        company_reg_number TEXT,
        bank_details       JSONB         DEFAULT ''{}''::jsonb,
        created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
      )', v_schema);

    -- =============================================
    -- 9. SUPPLIER PRODUCTS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.supplier_products (
        supplier_product_id UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_id         UUID          NOT NULL REFERENCES %I.suppliers(supplier_id) ON DELETE CASCADE,
        plu_id              UUID          NOT NULL REFERENCES %I.plu(plu_id) ON DELETE CASCADE,
        supplier_sku        TEXT,
        cost_price          NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        is_preferred        BOOLEAN       NOT NULL DEFAULT false,
        lead_time_days      INTEGER       NOT NULL DEFAULT 3,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        UNIQUE(supplier_id, plu_id)
      )', v_schema, v_schema, v_schema);

    -- =============================================
    -- 10. PURCHASE ORDERS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.purchase_orders (
        po_id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        po_number              TEXT          NOT NULL UNIQUE,
        supplier_id            UUID          NOT NULL REFERENCES %I.suppliers(supplier_id) ON DELETE RESTRICT,
        store_id               UUID          NOT NULL REFERENCES %I.stores(store_id) ON DELETE RESTRICT,
        status                 TEXT          NOT NULL DEFAULT ''draft'',
        total_cost             NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        created_by             UUID,
        created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
        downloaded_at          TIMESTAMPTZ,
        received_at            TIMESTAMPTZ,
        expected_delivery_date DATE
      )', v_schema, v_schema, v_schema);

    -- =============================================
    -- 11. PURCHASE ORDER ITEMS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.purchase_order_items (
        po_item_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        po_id              UUID          NOT NULL REFERENCES %I.purchase_orders(po_id) ON DELETE CASCADE,
        plu_id             UUID          NOT NULL REFERENCES %I.plu(plu_id) ON DELETE CASCADE,
        quantity_ordered   INTEGER       NOT NULL CHECK (quantity_ordered > 0),
        cost_price_at_order NUMERIC(10,2) NOT NULL,
        quantity_received  INTEGER       NOT NULL DEFAULT 0,
        UNIQUE(po_id, plu_id)
      )', v_schema, v_schema, v_schema);

    -- =============================================
    -- 12. LOYALTY CARDS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.loyalty_cards (
        card_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id         UUID REFERENCES %I.stores(store_id) ON DELETE CASCADE,
        card_number      VARCHAR(20) UNIQUE NOT NULL,
        customer_name    TEXT NOT NULL,
        phone            VARCHAR(20),
        email            TEXT,
        postcode         VARCHAR(10),
        cashback_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        is_active        BOOLEAN NOT NULL DEFAULT true,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by       UUID
      )', v_schema, v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_loyalty_cards_number ON %I.loyalty_cards(card_number)', replace(v_schema, 'tenant_', ''), v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_loyalty_cards_store  ON %I.loyalty_cards(store_id)', replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 13. SALES TRANSACTIONS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.sales_transactions (
        transaction_id  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id        UUID           NOT NULL REFERENCES %I.stores(store_id) ON DELETE RESTRICT,
        staff_user_id   UUID           NOT NULL,
        total_amount    NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
        discount_amount NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
        payment_method  TEXT           NOT NULL DEFAULT ''cash'',
        payment_note    TEXT,
        loyalty_card_id UUID           REFERENCES %I.loyalty_cards(card_id) ON DELETE SET NULL,
        status          TEXT           NOT NULL DEFAULT ''completed'',
        created_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
      )', v_schema, v_schema, v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sales_tx_store ON %I.sales_transactions(store_id, created_at DESC)', replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 14. SALE ITEMS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.sale_items (
        sale_item_id   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID          NOT NULL REFERENCES %I.sales_transactions(transaction_id) ON DELETE CASCADE,
        plu_id         UUID          REFERENCES %I.plu(plu_id) ON DELETE SET NULL,
        plu_name       TEXT          NOT NULL,
        quantity       NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
        unit_price     NUMERIC(12,2) NOT NULL,
        total_price    NUMERIC(12,2) NOT NULL
      )', v_schema, v_schema, v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sale_items_tx ON %I.sale_items(transaction_id)', replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 15. ITEM SIZING
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.item_sizing (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_type       VARCHAR(10)   NOT NULL CHECK (unit_type IN (''each'', ''kg'')),
        units_per_pack  DECIMAL(12,4) NOT NULL CHECK (units_per_pack > 0),
        packs_per_case  DECIMAL(12,4) NOT NULL CHECK (packs_per_case > 0),
        created_at      TIMESTAMPTZ   DEFAULT now(),
        updated_at      TIMESTAMPTZ   DEFAULT now()
      )', v_schema);

    EXECUTE format('
      CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_item_sizing_config
        ON %I.item_sizing (unit_type, units_per_pack, packs_per_case)',
      replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 16. STAFF TIMESHEETS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.staff_timesheets (
        timesheet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id     UUID NOT NULL REFERENCES %I.stores(store_id) ON DELETE CASCADE,
        user_id      UUID NOT NULL,
        clock_in     TIMESTAMPTZ NOT NULL DEFAULT now(),
        clock_out    TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )', v_schema, v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_staff_timesheets_user_date ON %I.staff_timesheets(user_id, clock_in DESC)', replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 17. STORE CHECKLISTS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.store_checklists (
        checklist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id     UUID NOT NULL REFERENCES %I.stores(store_id) ON DELETE CASCADE,
        type         TEXT NOT NULL CHECK (type IN (''start'', ''end'')),
        task_name    TEXT NOT NULL,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )', v_schema, v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_store_checklists_store_type ON %I.store_checklists(store_id, type, sort_order)', replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- 18. SYSTEM SETTINGS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.system_settings (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )', v_schema);

    -- Seed default settings if not present
    EXECUTE format($sql$
      INSERT INTO %I.system_settings (key, value) VALUES
        ('currency', jsonb_build_object('symbol', '£', 'code', 'GBP', 'notes', jsonb_build_array(50, 20, 10, 5), 'coins', jsonb_build_array(2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01))),
        ('loyalty_cashback_percent', jsonb_build_object('percent', 5))
      ON CONFLICT (key) DO NOTHING
    $sql$, v_schema);

    -- =============================================
    -- 19. LOYALTY NOTIFICATIONS
    -- =============================================
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.loyalty_notifications (
        notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title           TEXT NOT NULL,
        body            TEXT NOT NULL,
        store_id        UUID REFERENCES %I.stores(store_id) ON DELETE CASCADE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by      UUID,
        sent_at         TIMESTAMPTZ
      )', v_schema, v_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_loyalty_notifications_store ON %I.loyalty_notifications(store_id)', replace(v_schema, 'tenant_', ''), v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_loyalty_notifications_sent ON %I.loyalty_notifications(sent_at)', replace(v_schema, 'tenant_', ''), v_schema);

    -- =============================================
    -- ROW LEVEL SECURITY
    -- =============================================

    -- Create helper functions if missing
    EXECUTE format('
      CREATE OR REPLACE FUNCTION %I.get_user_role()
      RETURNS VARCHAR
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = %I
      AS $$ SELECT role FROM users WHERE user_id = auth.uid(); $$',
      v_schema, v_schema);

    EXECUTE format('
      CREATE OR REPLACE FUNCTION %I.get_user_store_id()
      RETURNS UUID
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = %I
      AS $$ SELECT assigned_store_id FROM users WHERE user_id = auth.uid(); $$',
      v_schema, v_schema);

    -- Enable RLS
    EXECUTE format('ALTER TABLE %I.stores                ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.users                 ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.inventory             ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.plu_categories        ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.plu                   ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.logbook               ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.plu_scheduled_changes ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.suppliers             ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.supplier_products     ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.purchase_orders       ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.purchase_order_items  ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.loyalty_cards         ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.sales_transactions    ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.sale_items            ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.item_sizing           ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.staff_timesheets      ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.store_checklists      ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('ALTER TABLE %I.loyalty_notifications ENABLE ROW LEVEL SECURITY', v_schema);

    -- RLS policies (safe to recreate)
    EXECUTE format('DROP POLICY IF EXISTS "stores_admin_full_access" ON %I.stores', v_schema);
    EXECUTE format('
      CREATE POLICY "stores_admin_full_access" ON %I.stores
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "stores_user_read_own" ON %I.stores', v_schema);
    EXECUTE format('
      CREATE POLICY "stores_user_read_own" ON %I.stores
        FOR SELECT USING (store_id = %I.get_user_store_id())',
      v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "users_superuser_full_access" ON %I.users', v_schema);
    EXECUTE format('
      CREATE POLICY "users_superuser_full_access" ON %I.users
        FOR ALL USING (%I.get_user_role() = ''super_user'')
        WITH CHECK (%I.get_user_role() = ''super_user'')',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "users_admin_manage" ON %I.users', v_schema);
    EXECUTE format('
      CREATE POLICY "users_admin_manage" ON %I.users
        FOR ALL USING (%I.get_user_role() = ''admin'' AND role != ''super_user'')
        WITH CHECK (%I.get_user_role() = ''admin'' AND role != ''super_user'')',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "users_read_self" ON %I.users', v_schema);
    EXECUTE format('
      CREATE POLICY "users_read_self" ON %I.users
        FOR SELECT USING (user_id = auth.uid())',
      v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "inventory_admin_full_access" ON %I.inventory', v_schema);
    EXECUTE format('
      CREATE POLICY "inventory_admin_full_access" ON %I.inventory
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "inventory_user_read_own" ON %I.inventory', v_schema);
    EXECUTE format('
      CREATE POLICY "inventory_user_read_own" ON %I.inventory
        FOR SELECT USING (store_id = %I.get_user_store_id())',
      v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "plu_categories_admin_full_access" ON %I.plu_categories', v_schema);
    EXECUTE format('
      CREATE POLICY "plu_categories_admin_full_access" ON %I.plu_categories
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "plu_categories_user_read" ON %I.plu_categories', v_schema);
    EXECUTE format('
      CREATE POLICY "plu_categories_user_read" ON %I.plu_categories
        FOR SELECT USING (true)',
      v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "plu_admin_full_access" ON %I.plu', v_schema);
    EXECUTE format('
      CREATE POLICY "plu_admin_full_access" ON %I.plu
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "plu_user_read" ON %I.plu', v_schema);
    EXECUTE format('
      CREATE POLICY "plu_user_read" ON %I.plu
        FOR SELECT USING (true)',
      v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "logbook_admin_read" ON %I.logbook', v_schema);
    EXECUTE format('
      CREATE POLICY "logbook_admin_read" ON %I.logbook
        FOR SELECT USING (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "logbook_authenticated_insert" ON %I.logbook', v_schema);
    EXECUTE format('
      CREATE POLICY "logbook_authenticated_insert" ON %I.logbook
        FOR INSERT WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "schedule_admin_full_access" ON %I.plu_scheduled_changes', v_schema);
    EXECUTE format('
      CREATE POLICY "schedule_admin_full_access" ON %I.plu_scheduled_changes
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "suppliers_admin_all" ON %I.suppliers', v_schema);
    EXECUTE format('
      CREATE POLICY "suppliers_admin_all" ON %I.suppliers
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "supplier_products_admin_all" ON %I.supplier_products', v_schema);
    EXECUTE format('
      CREATE POLICY "supplier_products_admin_all" ON %I.supplier_products
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "purchase_orders_admin_all" ON %I.purchase_orders', v_schema);
    EXECUTE format('
      CREATE POLICY "purchase_orders_admin_all" ON %I.purchase_orders
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "purchase_order_items_admin_all" ON %I.purchase_order_items', v_schema);
    EXECUTE format('
      CREATE POLICY "purchase_order_items_admin_all" ON %I.purchase_order_items
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "sales_admin_full_access" ON %I.sales_transactions', v_schema);
    EXECUTE format('
      CREATE POLICY "sales_admin_full_access" ON %I.sales_transactions
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM %I.users WHERE user_id = auth.uid() AND role IN (''admin'', ''super_user'')))',
      v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "sale_items_admin_full_access" ON %I.sale_items', v_schema);
    EXECUTE format('
      CREATE POLICY "sale_items_admin_full_access" ON %I.sale_items
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM %I.users WHERE user_id = auth.uid() AND role IN (''admin'', ''super_user'')))',
      v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "timesheets_admin_full_access" ON %I.staff_timesheets', v_schema);
    EXECUTE format('
      CREATE POLICY "timesheets_admin_full_access" ON %I.staff_timesheets
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM %I.users WHERE user_id = auth.uid() AND role IN (''admin'', ''super_user'')))',
      v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "checklists_admin_full_access" ON %I.store_checklists', v_schema);
    EXECUTE format('
      CREATE POLICY "checklists_admin_full_access" ON %I.store_checklists
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM %I.users WHERE user_id = auth.uid() AND role IN (''admin'', ''super_user'')))',
      v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "item_sizing_admin_full_access" ON %I.item_sizing', v_schema);
    EXECUTE format('
      CREATE POLICY "item_sizing_admin_full_access" ON %I.item_sizing
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "loyalty_cards_admin_all" ON %I.loyalty_cards', v_schema);
    EXECUTE format('
      CREATE POLICY "loyalty_cards_admin_all" ON %I.loyalty_cards
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS "loyalty_notifications_admin_all" ON %I.loyalty_notifications', v_schema);
    EXECUTE format('
      CREATE POLICY "loyalty_notifications_admin_all" ON %I.loyalty_notifications
        FOR ALL USING (%I.get_user_role() IN (''super_user'', ''admin''))
        WITH CHECK (%I.get_user_role() IN (''super_user'', ''admin''))',
      v_schema, v_schema, v_schema);

  END LOOP;
END;
$outer$;
