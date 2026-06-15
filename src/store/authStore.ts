// src/store/authStore.ts
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { getSupabaseClient } from '../lib/supabaseClient';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    try {
      const supabase = getSupabaseClient();

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        set({ profile: profile as UserProfile | null });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ session, user: session?.user ?? null });

        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
          set({ profile: profile as UserProfile | null });
        } else {
          set({ profile: null });
        }
      });
    } catch {
      console.warn('Auth initialization failed — Supabase may not be configured yet.');
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) return { error: error.message };

      // Profile will be loaded by the auth state listener
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  signOut: async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    set({ session: null, user: null, profile: null });
  },

  changePassword: async (newPassword) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) return { error: error.message };

      if (data.user) {
        // Update flag in database
        const { error: dbError } = await supabase
          .from('users')
          .update({ requires_password_change: false })
          .eq('user_id', data.user.id);
        
        if (dbError) return { error: dbError.message };

        // Update local profile state
        const currentProfile = get().profile;
        if (currentProfile) {
          set({ profile: { ...currentProfile, requires_password_change: false } });
        }
      }

      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },
}));
