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
            console.log('[AUTH] event', event, session ? 'has session' : 'no session');
            set({ session, user: session?.user ?? null });

            if (event === 'PASSWORD_RECOVERY') {
              set({ isRecoveryMode: true });
              return;
            }

            if (session?.user) {
              await resolveUserTypeOnce(session.user, supabase, set);
              console.log('[AUTH] resolveUserType done for event', event);
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
      console.log('[AUTH] signInWithPassword...');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('[AUTH] signInWithPassword done', error ? `ERROR: ${error.message}` : 'OK');
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
    sessionStorage.removeItem('pos_store_id');
    sessionStorage.removeItem('pos_store_name');
    set({ session: null, user: null, profile: null, superUser: null, userType: null });
  },

  changePassword: async (newPassword) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) return { error: error.message };

      if (data.user) {
        const state = get();
        const tenantSchema = state.user?.user_metadata?.tenant_schema;
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
}));

async function resolveUserType(
  user: User,
  supabase: ReturnType<typeof getSupabaseClient>,
  set: (partial: Partial<AuthState>) => void,
) {
  const meta = user.user_metadata || {};
  console.log('[AUTH] resolveUserType for', user.email, 'meta:', JSON.stringify(meta));

  // Check if super admin / support (exists in public.super_users)
  if (meta.is_super_admin || meta.is_support) {
    try {
      const { data: su, error: suErr } = await withTimeout(
        supabase
          .from('super_users')
          .select('*')
          .eq('super_user_id', user.id)
          .single(),
        3000,
        'super_users query',
      );
      console.log('[AUTH] super_users query', suErr ? `ERROR: ${suErr.message}` : su ? `found role=${su.role}` : 'no row');

      if (su) {
        set({
          superUser: su as SuperUser,
          profile: null,
          userType: su.role === 'support' ? 'support' : 'super_admin',
        });
        return;
      }
    } catch (timeoutErr) {
      // DB query hung (network/edge issue) — fall back to auth metadata so
      // login is never blocked by a stuck request.
      console.warn('[AUTH] super_users fallback:', (timeoutErr as Error).message);
      const fallback: SuperUser = {
        super_user_id: user.id,
        email: user.email ?? '',
        full_name: typeof meta.full_name === 'string' ? meta.full_name : '',
        role: meta.is_support ? 'support' : 'super_admin',
        is_active: true,
        created_at: user.created_at ?? new Date().toISOString(),
      };
      set({
        superUser: fallback,
        profile: null,
        userType: fallback.role === 'support' ? 'support' : 'super_admin',
      });
      return;
    }
  }

  // Check if tenant user (has tenant_schema in metadata)
  const tenantSchema = meta.tenant_schema;
  if (tenantSchema) {
    const tenantClient = getSupabaseClient(tenantSchema);
    const { data: profile } = await withTimeout(
      tenantClient
        .from('users')
        .select('*, stores!assigned_store_id(name)')
        .eq('user_id', user.id)
        .single(),
      3000,
      'tenant users query',
    );

    if (profile) {
      const raw = profile as UserProfile & { stores?: { name: string } | null };
      set({
        profile: { ...raw, assigned_store_name: raw.stores?.name ?? undefined },
        superUser: null,
        userType: raw.role === 'admin' ? 'tenant_admin' : 'tenant_user',
      });
      return;
    }
  }

  // No match found — user exists in auth but not in our tables
  set({ profile: null, superUser: null, userType: null });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}
