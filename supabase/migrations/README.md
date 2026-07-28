# Supabase Migrations — Multi-Tenant Schema

## Architecture

This project uses **PostgreSQL schema-per-tenant** isolation. Each company gets their
own database schema (e.g. `tenant_a1b2c3`) containing all 18 business tables.
The `public` schema holds only system-level shared tables visible to super admins.

```
public schema (your team only)
├── super_users              — system administrators (super_admin, support)
├── plans                    — subscription tiers
├── tenants                  — registered companies (points to their schema)
├── tenant_subscriptions     — plan assignments
├── exec_sql(text)           — helper to run raw SQL via RPC
└── provision_tenant()       — function that creates a full tenant schema

tenant_<uuid> schema (one per company)
├── users, stores, inventory, plu_categories, plu
├── logbook, plu_scheduled_changes
├── suppliers, supplier_products, purchase_orders, po_items
├── loyalty_cards, sales_transactions, sale_items
├── item_sizing, staff_timesheets, store_checklists
├── system_settings, loyalty_notifications
└── RLS policies + helper functions
```

## Migration Order

Run these in the Supabase SQL Editor in this exact order:

```
 1. 000_public_tables.sql         — shared tables + RLS
 2. 001_provision_function.sql    — provision_tenant() function
 3. 002_seed_plans.sql            — default pricing plans
 4. (skip 999 files — those are for teardown only)
```

After migrations, create your first super admin:

```bash
# Set env vars, then run:
npx tsx scripts/seedSuperUser.ts
```

This creates `info@performabi.com` in `auth.users` and `public.super_users`.

Then provision your own company's tenant via SQL:

```sql
SELECT provision_tenant(
  'Performabi',                                    -- company name
  'performabi',                                    -- URL slug
  (SELECT plan_id FROM public.plans WHERE name = 'Enterprise')  -- plan
);
```

## How Tenant Routing Works

1. User logs in via Supabase Auth (shared across all tenants)
2. Their JWT contains `user_metadata.tenant_schema`
3. API middleware reads this, creates Supabase client with `db: { schema }`
4. All queries resolve to that tenant's schema — **zero data leakage**
5. Super admins have no `tenant_schema` — their queries use `public` schema

## File Reference

| File | Purpose |
|---|---|
| `000_public_tables.sql` | Shared tables: super_users, plans, tenants, subscriptions, exec_sql() |
| `001_provision_function.sql` | `provision_tenant()` — creates a full tenant schema with 18 tables + RLS |
| `002_seed_plans.sql` | Default plans (Starter, Professional, Enterprise) |
| `999_clear_all_data.sql` | TRUNCATE all data across all tenant schemas + public (keeps structure) |
| `999_drop_all.sql` | DROP all tenant schemas + public tables (destroys everything) |

## Creating a New Company (via Admin UI)

1. Log in as `super_admin` → `/admin/dashboard`
2. Go to Tenants → **Provision New Company**
3. Fill in: company name, slug, plan, admin email + name
4. System provisions the schema and sends an **invite email** to the admin
5. Admin clicks the invite link, sets password, logs in
6. Admin manages their own staff, stores, and data from `/app/*`

## Creating Super Admins / Support Agents

1. Log in as `super_admin` → `/admin/team`
2. Click **Add Team Member**
3. Enter email, full name, role (super_admin or support)
4. System sends an invite email with a magic link
5. Recipient sets password and accesses `/admin/*`

## Teardown

To reset the entire database:

```sql
-- 1. Drop all tenant schemas + public tables
--    (run 999_drop_all.sql in the SQL Editor)
-- 2. Re-run 000, 001, 002 in order
```
