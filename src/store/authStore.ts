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

      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        await resolveUserType(session.user, supabase, set);
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          set({ session, user: session?.user ?? null });

          if (event === 'PASSWORD_RECOVERY') {
            set({ isRecoveryMode: true });
            return;
          }

          if (session?.user) {
            await resolveUserType(session.user, supabase, set);
          } else {
            set({ profile: null, superUser: null, userType: null, isRecoveryMode: false });
          }
        } catch {
          console.warn('onAuthStateChange handler failed.');
        }
      });
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

  // Check if super admin / support (exists in public.super_users)
  if (meta.is_super_admin || meta.is_support) {
    const { data: su } = await supabase
      .from('super_users')
      .select('*')
      .eq('super_user_id', user.id)
      .single();

    if (su) {
      set({
        superUser: su as SuperUser,
        profile: null,
        userType: su.role === 'support' ? 'support' : 'super_admin',
      });
      return;
    }
  }

  // Check if tenant user (has tenant_schema in metadata)
  const tenantSchema = meta.tenant_schema;
  if (tenantSchema) {
    const tenantClient = getSupabaseClient(tenantSchema);
    const { data: profile } = await tenantClient
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      set({
        profile: profile as UserProfile,
        superUser: null,
        userType: profile.role === 'admin' ? 'tenant_admin' : 'tenant_user',
      });
      return;
    }
  }

  // No match found — user exists in auth but not in our tables
  set({ profile: null, superUser: null, userType: null });
}
