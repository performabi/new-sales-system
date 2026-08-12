-- =============================================
-- Inventory canonicalisation: plu_id column + FK
-- Run this ONCE in the Supabase SQL console (no per-tenant edits needed).
-- Adds inventory.plu_id, backfills it from plu (uuid-name and name
-- matches), then links plu -> plu_categories for display joins.
-- =============================================

DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN SELECT schema_name FROM public.tenants WHERE is_active = true LOOP
    EXECUTE format('ALTER TABLE %I.inventory ADD COLUMN IF NOT EXISTS plu_id uuid', s);

    -- Backfill from rows whose name IS a plu uuid (legacy goods-in rows)
    EXECUTE format($q$
      UPDATE %I.inventory i
      SET plu_id = p.plu_id
      FROM %I.plu p
      WHERE i.plu_id IS NULL AND i.name = p.plu_id::text
    $q$, s, s);

    -- Backfill rows whose name equals the plu name
    EXECUTE format($q$
      UPDATE %I.inventory i
      SET plu_id = p.plu_id
      FROM %I.plu p
      WHERE i.plu_id IS NULL AND i.name = p.name
    $q$, s, s);

    -- FK enables PostgREST joins inventory -> plu -> plu_categories
    EXECUTE format($q$
      ALTER TABLE %I.inventory
        ADD CONSTRAINT inventory_plu_id_fkey FOREIGN KEY (plu_id) REFERENCES %I.plu(plu_id)
    $q$, s, s);

    EXECUTE format($q$
      CREATE UNIQUE INDEX IF NOT EXISTS inventory_store_plu ON %I.inventory(store_id, plu_id) WHERE plu_id IS NOT NULL
    $q$, s);

    RAISE NOTICE 'inventory canonicalised in %', s;
  END LOOP;
END $$;