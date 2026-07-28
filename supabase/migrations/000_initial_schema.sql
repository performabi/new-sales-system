-- =============================================
-- JGS Sales & Stock System — Full Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. USERS (links to Supabase Auth)
--    created before stores to break circular FK
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username               VARCHAR(50) UNIQUE NOT NULL,
  email                  VARCHAR(255),
  pin_hash               TEXT,
  full_name              VARCHAR(255) NOT NULL,
  role                   VARCHAR(20) NOT NULL CHECK (role IN ('super_user', 'admin', 'user')),
  is_active              BOOLEAN DEFAULT true,
  requires_password_change BOOLEAN DEFAULT false,
  assigned_store_id      UUID,
  created_at             TIMESTAMPTZ DEFAULT now(),
  created_by             UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- =============================================
-- 2. STORES
-- =============================================
CREATE TABLE IF NOT EXISTS public.stores (
  store_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  address       TEXT NOT NULL,
  postcode      VARCHAR(20) NOT NULL,
  vat_number    VARCHAR(50) NOT NULL,
  store_number  VARCHAR(10),
  is_active     BOOLEAN DEFAULT true,
  created_by    UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Now that stores exists, wire up the FK on users
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_assigned_store
  FOREIGN KEY (assigned_store_id) REFERENCES public.stores(store_id) ON DELETE SET NULL;

-- =============================================
-- 3. INVENTORY
-- =============================================
CREATE TABLE IF NOT EXISTS public.inventory (
  product_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES public.stores(store_id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL DEFAULT 'Unnamed Product',
  barcode_qr     VARCHAR(100),
  stock_quantity INTEGER DEFAULT 0,
  price          DECIMAL(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON public.inventory(barcode_qr);

-- =============================================
-- 4. PLU CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS public.plu_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT now(),
  created_by  UUID         REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================
-- 5. PLU (products)
-- =============================================
CREATE TABLE IF NOT EXISTS public.plu (
  plu_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plu_number       VARCHAR(50) UNIQUE NOT NULL,
  name             VARCHAR(255) NOT NULL,
  category_id      UUID         REFERENCES public.plu_categories(category_id) ON DELETE SET NULL,
  vat_class        VARCHAR(20)  NOT NULL DEFAULT 'standard' CHECK (vat_class IN ('standard', 'zero_rated', 'exempt')),
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
);

CREATE INDEX IF NOT EXISTS idx_plu_number   ON public.plu(plu_number);
CREATE INDEX IF NOT EXISTS idx_plu_ean      ON public.plu(ean);
CREATE INDEX IF NOT EXISTS idx_plu_category ON public.plu(category_id);

-- =============================================
-- 6. LOGBOOK
-- =============================================
CREATE TABLE IF NOT EXISTS public.logbook (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  entity        TEXT          NOT NULL,
  entity_label  TEXT          NOT NULL,
  field         TEXT          NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  username      TEXT          NOT NULL,
  action        TEXT          NOT NULL DEFAULT 'edit'
);

CREATE INDEX IF NOT EXISTS logbook_timestamp_idx ON public.logbook (timestamp DESC);
CREATE INDEX IF NOT EXISTS logbook_entity_idx    ON public.logbook (entity);
CREATE INDEX IF NOT EXISTS logbook_action_idx    ON public.logbook (action);

-- =============================================
-- 7. PLU SCHEDULED CHANGES
-- =============================================
CREATE TABLE IF NOT EXISTS public.plu_scheduled_changes (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plu_id          UUID          NOT NULL REFERENCES public.plu(plu_id) ON DELETE CASCADE,
  payload         JSONB         NOT NULL,
  scheduled_at    TIMESTAMPTZ   NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      TEXT,
  applied         BOOLEAN       NOT NULL DEFAULT false,
  applied_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS plu_schedule_pending_idx ON public.plu_scheduled_changes (scheduled_at, applied)
  WHERE applied = false;

-- =============================================
-- 8. SUPPLIERS
-- =============================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  supplier_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT          NOT NULL UNIQUE,
  contact_email      TEXT          NOT NULL,
  phone              TEXT,
  address            TEXT,
  payment_terms      TEXT,
  vat_number         TEXT,
  company_reg_number TEXT,
  bank_details       JSONB         DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- =============================================
-- 9. SUPPLIER PRODUCTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.supplier_products (
  supplier_product_id UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID          NOT NULL REFERENCES public.suppliers(supplier_id) ON DELETE CASCADE,
  plu_id              UUID          NOT NULL REFERENCES public.plu(plu_id) ON DELETE CASCADE,
  supplier_sku        TEXT,
  cost_price          NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_preferred        BOOLEAN       NOT NULL DEFAULT false,
  lead_time_days      INTEGER       NOT NULL DEFAULT 3,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, plu_id)
);

-- =============================================
-- 10. PURCHASE ORDERS
-- =============================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  po_id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number              TEXT          NOT NULL UNIQUE,
  supplier_id            UUID          NOT NULL REFERENCES public.suppliers(supplier_id) ON DELETE RESTRICT,
  store_id               UUID          NOT NULL REFERENCES public.stores(store_id) ON DELETE RESTRICT,
  status                 TEXT          NOT NULL DEFAULT 'draft',
  total_cost             NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_by             UUID,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  downloaded_at          TIMESTAMPTZ,
  received_at            TIMESTAMPTZ,
  expected_delivery_date DATE
);

-- =============================================
-- 11. PURCHASE ORDER ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  po_item_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id              UUID          NOT NULL REFERENCES public.purchase_orders(po_id) ON DELETE CASCADE,
  plu_id             UUID          NOT NULL REFERENCES public.plu(plu_id) ON DELETE CASCADE,
  quantity_ordered   INTEGER       NOT NULL CHECK (quantity_ordered > 0),
  cost_price_at_order NUMERIC(10,2) NOT NULL,
  quantity_received  INTEGER       NOT NULL DEFAULT 0,
  UNIQUE(po_id, plu_id)
);

-- =============================================
-- 12. SALES TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.sales_transactions (
  transaction_id  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID           NOT NULL REFERENCES public.stores(store_id) ON DELETE RESTRICT,
  staff_user_id   UUID           NOT NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
  total_amount    NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
  payment_method  TEXT           NOT NULL DEFAULT 'cash',
  payment_note    TEXT,
  loyalty_card_id UUID           REFERENCES public.loyalty_cards(card_id) ON DELETE SET NULL,
  status          TEXT           NOT NULL DEFAULT 'completed',
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_store ON public.sales_transactions(store_id, created_at DESC);

-- =============================================
-- 13. SALE ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.sale_items (
  sale_item_id   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID          NOT NULL REFERENCES public.sales_transactions(transaction_id) ON DELETE CASCADE,
  plu_id         UUID          REFERENCES public.plu(plu_id) ON DELETE SET NULL,
  plu_name       TEXT          NOT NULL,
  quantity       NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(12,2) NOT NULL,
  total_price    NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_transaction ON public.sale_items(transaction_id);

-- =============================================
-- 14. ITEM SIZING
-- =============================================
CREATE TABLE IF NOT EXISTS public.item_sizing (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_type       VARCHAR(10)   NOT NULL CHECK (unit_type IN ('each', 'kg')),
  units_per_pack  DECIMAL(12,4) NOT NULL CHECK (units_per_pack > 0),
  packs_per_case  DECIMAL(12,4) NOT NULL CHECK (packs_per_case > 0),
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_sizing_config
  ON public.item_sizing (unit_type, units_per_pack, packs_per_case);

-- =============================================
-- 15. STAFF TIMESHEETS
-- =============================================
CREATE TABLE IF NOT EXISTS public.staff_timesheets (
  timesheet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES public.stores(store_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  clock_in     TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_timesheets_user_date
  ON public.staff_timesheets(user_id, clock_in DESC);

-- =============================================
-- 16. STORE CHECKLISTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.store_checklists (
  checklist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES public.stores(store_id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('start', 'end')),
  task_name    TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_checklists_store_type
  ON public.store_checklists(store_id, type, sort_order);

-- =============================================
-- 17. LOYALTY CARDS
-- =============================================
CREATE TABLE IF NOT EXISTS public.loyalty_cards (
  card_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES public.stores(store_id) ON DELETE CASCADE,
  card_number      VARCHAR(20) UNIQUE NOT NULL,
  customer_name    TEXT NOT NULL,
  phone            VARCHAR(20),
  email            TEXT,
  postcode         VARCHAR(10),
  cashback_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_loyalty_cards_number ON public.loyalty_cards(card_number);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_store  ON public.loyalty_cards(store_id);

-- =============================================
-- 18. SYSTEM SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 19. LOYALTY NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.loyalty_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  store_id        UUID REFERENCES public.stores(store_id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_loyalty_notifications_store ON public.loyalty_notifications(store_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_notifications_sent ON public.loyalty_notifications(sent_at);

-- =============================================
-- SEED DATA
-- =============================================

-- Currency configuration
INSERT INTO public.system_settings (key, value) VALUES
  ('currency', '{"symbol":"£","code":"GBP","notes":[50,20,10,5],"coins":[2,1,0.5,0.2,0.1,0.05,0.02,0.01]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Loyalty cashback default (5%)
INSERT INTO public.system_settings (key, value) VALUES
  ('loyalty_cashback_percent', '{"percent":5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_store_id FROM users WHERE user_id = auth.uid();
$$;

ALTER TABLE public.stores                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plu_categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plu                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plu_scheduled_changes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_sizing               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_timesheets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_checklists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_notifications     ENABLE ROW LEVEL SECURITY;

-- Stores
CREATE POLICY "stores_admin_full_access" ON public.stores
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

CREATE POLICY "stores_user_read_own" ON public.stores
  FOR SELECT USING (store_id = public.get_user_store_id());

-- Users
CREATE POLICY "users_superuser_full_access" ON public.users
  FOR ALL USING (public.get_user_role() = 'super_user')
  WITH CHECK (public.get_user_role() = 'super_user');

CREATE POLICY "users_admin_manage" ON public.users
  FOR ALL USING (public.get_user_role() = 'admin' AND role != 'super_user')
  WITH CHECK (public.get_user_role() = 'admin' AND role != 'super_user');

CREATE POLICY "users_read_self" ON public.users
  FOR SELECT USING (user_id = auth.uid());

-- Inventory
CREATE POLICY "inventory_admin_full_access" ON public.inventory
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

CREATE POLICY "inventory_user_read_own" ON public.inventory
  FOR SELECT USING (store_id = public.get_user_store_id());

-- PLU Categories
CREATE POLICY "plu_categories_admin_full_access" ON public.plu_categories
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

CREATE POLICY "plu_categories_user_read" ON public.plu_categories
  FOR SELECT USING (true);

-- PLU
CREATE POLICY "plu_admin_full_access" ON public.plu
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

CREATE POLICY "plu_user_read" ON public.plu
  FOR SELECT USING (true);

-- Logbook
CREATE POLICY "logbook_admin_read" ON public.logbook
  FOR SELECT USING (public.get_user_role() IN ('super_user', 'admin'));

CREATE POLICY "logbook_authenticated_insert" ON public.logbook
  FOR INSERT WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

-- PLU Scheduled Changes
CREATE POLICY "schedule_admin_full_access" ON public.plu_scheduled_changes
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

-- Suppliers
CREATE POLICY "suppliers_admin_all" ON public.suppliers
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

-- Supplier Products
CREATE POLICY "supplier_products_admin_all" ON public.supplier_products
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

-- Purchase Orders
CREATE POLICY "purchase_orders_admin_all" ON public.purchase_orders
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

-- Purchase Order Items
CREATE POLICY "purchase_order_items_admin_all" ON public.purchase_order_items
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

-- Sales Transactions
CREATE POLICY "sales_admin_full_access" ON public.sales_transactions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role IN ('admin', 'super_user')));

-- Sale Items
CREATE POLICY "sale_items_admin_full_access" ON public.sale_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role IN ('admin', 'super_user')));

-- Staff Timesheets
CREATE POLICY "timesheets_admin_full_access" ON public.staff_timesheets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role IN ('admin', 'super_user')));

-- Store Checklists
CREATE POLICY "checklists_admin_full_access" ON public.store_checklists
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role IN ('admin', 'super_user')));

-- Item Sizing
CREATE POLICY "item_sizing_admin_full_access" ON public.item_sizing
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

-- Loyalty Cards
CREATE POLICY "loyalty_cards_admin_all" ON public.loyalty_cards
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));

-- Loyalty Notifications
CREATE POLICY "loyalty_notifications_admin_all" ON public.loyalty_notifications
  FOR ALL USING (public.get_user_role() IN ('super_user', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_user', 'admin'));
