-- =============================================
-- System Provider Schema — Shared Tables
-- These live in the public schema and are
-- visible only to super_admins and support agents
-- =============================================

-- =============================================
-- 1. SUPER USERS (system-level administrators)
--    Above all tenant schemas. Your team only.
-- =============================================
CREATE TABLE IF NOT EXISTS public.super_users (
  super_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin', 'support')) DEFAULT 'super_admin',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID REFERENCES public.super_users(super_user_id) ON DELETE SET NULL
);

-- =============================================
-- 2. PLANS (subscription tiers)
-- =============================================
CREATE TABLE IF NOT EXISTS public.plans (
  plan_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_stores  INTEGER NOT NULL DEFAULT 1,
  max_users   INTEGER NOT NULL DEFAULT 5,
  features    JSONB DEFAULT '{}',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 3. TENANTS (registered companies)
-- =============================================
CREATE TABLE IF NOT EXISTS public.tenants (
  tenant_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  schema_name TEXT NOT NULL UNIQUE,
  domain      TEXT,
  is_active   BOOLEAN DEFAULT true,
  plan_id     UUID REFERENCES public.plans(plan_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  created_by  UUID REFERENCES public.super_users(super_user_id) ON DELETE SET NULL
);

-- =============================================
-- 4. TENANT SUBSCRIPTIONS (plan assignments)
-- =============================================
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  plan_id         UUID NOT NULL REFERENCES public.plans(plan_id),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'cancelled', 'expired')),
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 5. HELPER: exec_sql — runs raw SQL via RPC
--     Used by API to set search_path per session
-- =============================================
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.super_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read super_users (system-team table, not tenant data)
CREATE POLICY "super_users_read_own" ON public.super_users
  FOR SELECT TO authenticated
  USING (true);

-- Only super_admin can modify super_users (separate policies per operation)
CREATE POLICY "super_users_insert" ON public.super_users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = super_user_id AND role = 'super_admin');

CREATE POLICY "super_users_update" ON public.super_users
  FOR UPDATE TO authenticated
  USING (auth.uid() = super_user_id AND role = 'super_admin')
  WITH CHECK (auth.uid() = super_user_id AND role = 'super_admin');

CREATE POLICY "super_users_delete" ON public.super_users
  FOR DELETE TO authenticated
  USING (auth.uid() = super_user_id AND role = 'super_admin');

-- Plans visible to all authenticated super users
CREATE POLICY "plans_read" ON public.plans
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid()));

-- Only super_admin can modify plans
CREATE POLICY "plans_admin_all" ON public.plans
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid() AND role = 'super_admin'));

-- Tenants visible to all authenticated super users
CREATE POLICY "tenants_read" ON public.tenants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid()));

-- Only super_admin can modify tenants
CREATE POLICY "tenants_admin_all" ON public.tenants
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid() AND role = 'super_admin'));

-- Subscriptions visible to all authenticated super users
CREATE POLICY "subscriptions_read" ON public.tenant_subscriptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid()));

-- Only super_admin can modify subscriptions
CREATE POLICY "subscriptions_admin_all" ON public.tenant_subscriptions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_users WHERE super_user_id = auth.uid() AND role = 'super_admin'));

-- =============================================
-- SCHEMA PERMISSIONS
-- =============================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
