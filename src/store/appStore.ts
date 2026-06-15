// src/store/appStore.ts
import { create } from 'zustand';
import type { Store, UserProfile, InventoryItem, Toast } from '../types';
import { getSupabaseClient } from '../lib/supabaseClient';

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Stores
  stores: Store[];
  storesLoading: boolean;
  fetchStores: () => Promise<void>;
  addStore: (store: Omit<Store, 'store_id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateStore: (id: string, data: Partial<Store>) => Promise<{ error: string | null }>;
  deleteStore: (id: string) => Promise<{ error: string | null }>;

  // Users
  users: UserProfile[];
  usersLoading: boolean;
  fetchUsers: () => Promise<void>;
  addUser: (data: {
    email: string;
    password: string;
    username: string;
    full_name: string;
    role: 'admin' | 'user';
    pin: string;
    assigned_store_id: string | null;
  }) => Promise<{ error: string | null }>;
  updateUser: (id: string, data: Partial<UserProfile>) => Promise<{ error: string | null }>;
  deleteUser: (id: string) => Promise<{ error: string | null }>;
  resetUserPassword: (id: string) => Promise<{ error: string | null }>;

  // Inventory
  inventory: InventoryItem[];
  inventoryLoading: boolean;
  fetchInventory: () => Promise<void>;

  // Toasts
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
}

let toastId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  // ---------- Sidebar ----------
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // ---------- Stores ----------
  stores: [],
  storesLoading: false,

  fetchStores: async () => {
    set({ storesLoading: true });
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ stores: (data as Store[]) ?? [] });
    } catch (err) {
      console.error('fetchStores error:', err);
      get().addToast('error', 'Failed to load stores');
    } finally {
      set({ storesLoading: false });
    }
  },

  addStore: async (store) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('stores')
        .insert(store)
        .select()
        .single();
      if (error) return { error: error.message };
      set((s) => ({ stores: [data as Store, ...s.stores] }));
      get().addToast('success', `Store "${store.name}" created successfully`);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updateStore: async (id, data) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('stores')
        .update(data)
        .eq('store_id', id);
      if (error) return { error: error.message };
      set((s) => ({
        stores: s.stores.map((st) =>
          st.store_id === id ? { ...st, ...data } : st,
        ),
      }));
      get().addToast('success', 'Store updated successfully');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  deleteStore: async (id) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('store_id', id);
      if (error) return { error: error.message };
      set((s) => ({ stores: s.stores.filter((st) => st.store_id !== id) }));
      get().addToast('success', 'Store deleted');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- Users ----------
  users: [],
  usersLoading: false,

  fetchUsers: async () => {
    set({ usersLoading: true });
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('users')
        .select('*, stores(name)')
        .order('full_name');
      if (error) throw error;
      const mapped = (data ?? []).map((u: any) => ({
        ...u,
        assigned_store_name: u.stores?.name ?? 'Head Office',
        stores: undefined,
      })) as UserProfile[];
      set({ users: mapped });
    } catch (err) {
      console.error('fetchUsers error:', err);
      get().addToast('error', 'Failed to load users');
    } finally {
      set({ usersLoading: false });
    }
  },

  addUser: async (userData) => {
    try {
      // Use our custom Vite API route which uses the service_role key
      // This bypasses the "Allow new users to sign up" toggle in Supabase
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        return { error: result.error || 'Failed to create user' };
      }

      get().addToast('success', `User "${userData.username}" created successfully`);
      await get().fetchUsers();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updateUser: async (id, data) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { error: result.error || 'Failed to update user' };
      }

      set((s) => ({
        users: s.users.map((u) =>
          u.user_id === id ? { ...u, ...data } : u,
        ),
      }));
      get().addToast('success', 'User updated successfully');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  deleteUser: async (id) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to delete user' };
      }
      set((s) => ({ users: s.users.filter((u) => u.user_id !== id) }));
      get().addToast('success', 'User deleted');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  resetUserPassword: async (id) => {
    try {
      const response = await fetch(`/api/users/${id}/reset-password`, {
        method: 'PUT',
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to reset password' };
      }
      get().addToast('success', 'Password reset to Sales12345');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- Inventory ----------
  inventory: [],
  inventoryLoading: false,

  fetchInventory: async () => {
    set({ inventoryLoading: true });
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('inventory')
        .select('*, stores(name)')
        .order('name');
      if (error) throw error;
      const mapped = (data ?? []).map((item: any) => ({
        ...item,
        store_name: item.stores?.name ?? 'Unknown',
        stores: undefined,
      })) as InventoryItem[];
      set({ inventory: mapped });
    } catch (err) {
      console.error('fetchInventory error:', err);
      get().addToast('error', 'Failed to load inventory');
    } finally {
      set({ inventoryLoading: false });
    }
  },

  // ---------- Toasts ----------
  toasts: [],

  addToast: (type, message) => {
    const id = String(++toastId);
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
