import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile, SuperUser } from '../types';
import { getSupabaseClient } from '../lib/supabaseClient';

export type UserType = 'super_admin' | 'support' | 'tenant_admin' | 'tenant_user' | null;

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  superUser: SuperUser | null;
  userType: UserType;
  loading: boolean;
  isRecoveryMode: boolean;
  activeTenantSchema: string | null;
  pendingTenants: string[] | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setSuperUser: (superUser: SuperUser | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  selectTenant: (schema: string) => Promise<{ slug: string | null; role: string | null; error: string | null }>;
}

let authListenerRegistered = false;
let resolveTypeKey: string | null = null;
let resolveTypePromise: Promise<void> | null = null;

function resolveUserTypeOnce(
  user: User,
  supabase: ReturnType<typeof getSupabaseClient>,
  set: (partial: Partial<AuthState>) => void,
) {
  if (resolveTypePromise && resolveTypeKey === user.id) return resolveTypePromise;
  resolveTypeKey = user.id;
  resolveTypePromise = resolveUserType(user, supabase, set).finally(() => {
    resolveTypePromise = null;
    resolveTypeKey = null;
  });
  return resolveTypePromise;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  superUser: null,
  userType: null,
  loading: true,
  isRecoveryMode: false,
  activeTenantSchema: null,
  pendingTenants: null,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setSuperUser: (superUser) => set({ superUser }),
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    try {
      const supabase = getSupabaseClient();

      const isRecoveryUrl =
        typeof window !== 'undefined' &&
        (window.location.search.includes('type=recovery') ||
          window.location.hash.includes('type=recovery') ||
          window.location.search.includes('type=invite') ||
          window.location.hash.includes('type=invite') ||
          window.location.search.includes('type=signup') ||
          window.location.hash.includes('type=signup'));
      if (isRecoveryUrl) {
        set({ isRecoveryMode: true });
      }

      if (!authListenerRegistered) {
        authListenerRegistered = true;
        supabase.auth.onAuthStateChange(async (event, session) => {
          try {
            set({ session, user: session?.user ?? null });

            if (event === 'PASSWORD_RECOVERY') {
              set({ isRecoveryMode: true });
              return;
            }

            if (session?.user) {
              await resolveUserTypeOnce(session.user, supabase, set);
            } else {
              set({ profile: null, superUser: null, userType: null, isRecoveryMode: false });
            }
          } catch {
            console.warn('onAuthStateChange handler failed.');
          }
        });
      }

      await Promise.race([
        (async () => {
          // getUser() awaits storage restore + auto-refresh (getSession() alone
          // resolves null on a fresh load even with a valid stored session).
          const { data: { user } } = await supabase.auth.getUser();
          const { data: { session } } = await supabase.auth.getSession();
          set({ session, user: session?.user ?? null });
          if (user || session?.user) {
            await resolveUserTypeOnce((user || session?.user)! as never, supabase, set);
          }
        })(),
        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch {
      console.warn('Auth initialization failed.');
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  signOut: async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    sessionStorage.removeItem('pos_session');
    sessionStorage.removeItem('pos_token');
    sessionStorage.removeItem('pos_store_id');
    sessionStorage.removeItem('pos_store_name');
    set({ session: null, user: null, profile: null, superUser: null, userType: null, activeTenantSchema: null, pendingTenants: null });
  },

  changePassword: async (newPassword) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) return { error: error.message };

      if (data.user) {
        const state = get();
        const tenantSchema = state.activeTenantSchema || state.user?.user_metadata?.tenant_schema;
        if (tenantSchema) {
          const tenantClient = getSupabaseClient(tenantSchema);
          const { error: dbError } = await tenantClient
            .from('users')
            .update({ requires_password_change: false })
            .eq('user_id', data.user.id);

          if (dbError) return { error: dbError.message };
        }

        const currentProfile = state.profile;
        if (currentProfile) {
          set({ profile: { ...currentProfile, requires_password_change: false } });
        }
      }

      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  resetPassword: async (email) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updatePassword: async (newPassword) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: error.message };
      await get().signOut();
      set({ isRecoveryMode: false });
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  selectTenant: async (schema) => {
    const { user } = get();
    if (!user) return { slug: null, role: null, error: 'No active session' };
    try {
      const profile = await resolveTenantProfile(user, schema);
      if (!profile) return { slug: null, role: null, error: 'No profile found for this tenant' };
      const raw = profile as UserProfile & { stores?: { name: string } | null };
      set({
        profile: { ...raw, assigned_store_name: raw.stores?.name ?? undefined },
        superUser: null,
        userType: raw.role === 'admin' ? 'tenant_admin' : 'tenant_user',
        activeTenantSchema: schema,
        pendingTenants: null,
      });
      let slug: string | null = null;
      try {
        const headers = new Headers();
        const accessToken = get().session?.access_token;
        if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
        const res = await fetch(`/api/app/tenant-info?tenant_schema=${encodeURIComponent(schema)}`, { headers });
        if (res.ok) {
          const tenant = await res.json();
          slug = (tenant.slug as string) || null;
        }
      } catch {
        // slug is optional — page can fall back to /app/dashboard
      }
      return { slug, role: raw.role, error: null };
    } catch (err) {
      return { slug: null, role: null, error: (err as Error).message };
    }
  },
}));

async function resolveUserType(
  user: User,
  supabase: ReturnType<typeof getSupabaseClient>,
  set: (partial: Partial<AuthState>) => void,
) {
  const meta = user.user_metadata || {};

  // Check if super admin / support (exists in public.super_users)
  if (meta.is_super_admin || meta.is_support) {
    try {
      const { data: su } = await withTimeout(
        supabase
          .from('super_users')
          .select('super_user_id, email, full_name, role, is_active, created_at')
          .eq('super_user_id', user.id)
          .single(),
        3000,
        'super_users query',
      );

      if (su) {
        set({
          superUser: su as SuperUser,
          profile: null,
          userType: su.role === 'support' ? 'support' : 'super_admin',
        });
        return;
      }
    } catch (timeoutErr) {
      // DB query hung (network/edge issue) — retry once without the timeout.
      // Never fabricate a super_admin role from client metadata: server-side
      // endpoints independently verify super_users membership.
      console.warn('[AUTH] super_users query retry:', (timeoutErr as Error).message);
      try {
        const { data: suRetry } = await supabase
          .from('super_users')
          .select('super_user_id, email, full_name, role, is_active, created_at')
          .eq('super_user_id', user.id)
          .single();
        if (suRetry) {
          set({
            superUser: suRetry as SuperUser,
            profile: null,
            userType: suRetry.role === 'support' ? 'support' : 'super_admin',
          });
          return;
        }
      } catch {
        // give up — resolveUserType falls through to tenant checks
      }
    }
  }

  // Check if tenant user (has tenant_schema in metadata)
  const schemas =
    Array.isArray(meta.tenant_schemas) && (meta.tenant_schemas as string[]).length > 0
      ? (meta.tenant_schemas as string[])
      : meta.tenant_schema
        ? [meta.tenant_schema]
        : [];

  if (schemas.length > 1) {
    // Multiple tenants — require the user to pick one before resolving a profile
    set({ profile: null, superUser: null, userType: null, activeTenantSchema: null, pendingTenants: schemas });
    return;
  }

  if (schemas.length === 1) {
    const profile = await resolveTenantProfile(user, schemas[0]);
    if (profile) {
      const raw = profile as UserProfile & { stores?: { name: string } | null };
      set({
        profile: { ...raw, assigned_store_name: raw.stores?.name ?? undefined },
        superUser: null,
        userType: raw.role === 'admin' ? 'tenant_admin' : 'tenant_user',
        activeTenantSchema: schemas[0],
        pendingTenants: null,
      });
      return;
    }
  }

  // No match found — user exists in auth but not in our tables
  set({ profile: null, superUser: null, userType: null, activeTenantSchema: null, pendingTenants: null });
}

async function resolveTenantProfile(
  user: User,
  schema: string,
): Promise<(UserProfile & { stores?: { name: string } | null }) | null> {
  try {
    const tenantClient = getSupabaseClient(schema);
    const { data: profile } = await withTimeout(
      tenantClient
        .from('users')
        .select('user_id, email, username, full_name, role, is_active, requires_password_change, assigned_store_id, created_at, stores!assigned_store_id(name)')
        .eq('user_id', user.id)
        .single(),
      3000,
      'tenant users query',
    );
    return (profile as (UserProfile & { stores?: { name: string } | null }) | null) ?? null;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}
