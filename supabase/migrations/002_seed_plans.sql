-- =============================================
-- Default Subscription Plans
-- Run this AFTER 001_provision_function.sql
-- =============================================

INSERT INTO public.plans (name, description, price, max_stores, max_users, features) VALUES
  ('Starter',
   'For small shops — one store, basic features',
   0.00, 1, 3,
   '{"pos":true,"purchase_orders":true,"inventory":true,"loyalty":false,"reports":false}'::jsonb),

  ('Professional',
   'For growing businesses — multi-store, full features',
   49.00, 3, 15,
   '{"pos":true,"purchase_orders":true,"inventory":true,"loyalty":true,"reports":true,"plu_scheduling":true}'::jsonb),

  ('Enterprise',
   'Unlimited stores, dedicated support, custom integrations',
   149.00, 999, 999,
   '{"pos":true,"purchase_orders":true,"inventory":true,"loyalty":true,"reports":true,"plu_scheduling":true,"api_access":true,"dedicated_support":true}'::jsonb)

ON CONFLICT (name) DO NOTHING;

-- Note: The first super admin (info@performabi.com) should be created
-- by running:  npx tsx scripts/seedSuperUser.ts
-- This will create the auth.users entry + public.super_users record.
