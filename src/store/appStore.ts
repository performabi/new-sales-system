// src/store/appStore.ts
import { create } from 'zustand';
import type { Store, UserProfile, InventoryItem, Toast, PluCategory, Plu } from '../types';
import { getSupabaseClient } from '../lib/supabaseClient';

export interface LogEntry {
  id: string;
  timestamp: string;       // ISO
  entity: string;          // 'PLU' | 'Store' | 'Category' | 'User'
  entityLabel: string;     // human-readable name/number
  field: string;           // field that changed
  oldValue: string;
  newValue: string;
  username: string;        // who made the change
}

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
  resetUserPassword: (id: string, newPassword?: string) => Promise<{ error: string | null }>;

  // Inventory
  inventory: InventoryItem[];
  inventoryLoading: boolean;
  fetchInventory: () => Promise<void>;

  // PLU Categories
  pluCategories: PluCategory[];
  pluCategoriesLoading: boolean;
  fetchPluCategories: () => Promise<void>;
  addPluCategory: (name: string) => Promise<{ error: string | null }>;
  updatePluCategory: (id: string, name: string) => Promise<{ error: string | null }>;
  deletePluCategory: (id: string) => Promise<{ error: string | null }>;

  // PLU
  plusItems: Plu[];
  plusLoading: boolean;
  fetchPlus: () => Promise<void>;
  addPlu: (data: Omit<Plu, 'plu_id' | 'created_at' | 'category_name'>) => Promise<{ error: string | null }>;
  updatePlu: (id: string, data: Partial<Omit<Plu, 'plu_id' | 'created_at' | 'category_name'>>) => Promise<{ error: string | null }>;
  deletePlu: (id: string) => Promise<{ error: string | null }>;
  getNextPluNumber: () => Promise<string>;

  // Toasts
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;

  // Logbook
  logEntries: LogEntry[];
  logbookLoading: boolean;
  fetchLogbook: () => Promise<void>;
  addLogEntry: (entry: Omit<LogEntry, 'id' | 'timestamp' | 'username'>) => Promise<void>;
  exportLogCsv: () => void;

  // PLU Scheduled Changes
  schedulePluChange: (pluId: string, payload: Record<string, any>, scheduledAt: string, createdBy: string) => Promise<{ error: string | null }>;
  applyDueScheduledChanges: () => Promise<void>;
}

let toastId = 0;
let logId = 0;

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
        .order('store_number', { ascending: true });
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
      const { useAuthStore } = await import('./authStore');
      const userId = useAuthStore.getState().profile?.user_id || null;

      // Calculate next sequential 3-digit store number (e.g. "001", "002"...)
      const currentStores = get().stores;
      const numericNumbers = currentStores
        .map((s) => parseInt(s.store_number || '', 10))
        .filter((n) => !isNaN(n));
      const maxNum = numericNumbers.length > 0 ? Math.max(...numericNumbers) : 0;
      const nextStoreNumber = String(maxNum + 1).padStart(3, '0');

      const storePayload = {
        ...store,
        store_number: nextStoreNumber,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from('stores')
        .insert(storePayload)
        .select()
        .single();
      if (error) return { error: error.message };
      set((s) => ({ stores: [data as Store, ...s.stores].sort((a, b) => (a.store_number ?? '').localeCompare(b.store_number ?? '')) }));
      get().addToast('success', `Store "${store.name}" (No. ${nextStoreNumber}) created successfully`);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updateStore: async (id, data) => {
    try {
      const supabase = getSupabaseClient();
      // Capture old values before update for logging
      const oldStore = get().stores.find((s) => s.store_id === id);
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
      // Log each changed field
      if (oldStore) {
        for (const key of Object.keys(data) as (keyof typeof data)[]) {
          const oldVal = String(oldStore[key as keyof Store] ?? '');
          const newVal = String((data as any)[key] ?? '');
          if (oldVal !== newVal) {
            await get().addLogEntry({
              entity: 'Store',
              entityLabel: oldStore.name,
              field: key as string,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        }
      }
      get().addToast('success', 'Store updated successfully');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  deleteStore: async (id) => {
    try {
      const supabase = getSupabaseClient();
      const deletedStore = get().stores.find((s) => s.store_id === id);
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('store_id', id);
      if (error) return { error: error.message };
      // Log deletion
      if (deletedStore) {
        await get().addLogEntry({
          entity: 'Store',
          entityLabel: deletedStore.name,
          field: '[DELETED]',
          oldValue: deletedStore.name,
          newValue: '',
        });
      }
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
        .select('*, stores!users_assigned_store_id_fkey(name)')
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
      const { useAuthStore } = await import('./authStore');
      const createdById = useAuthStore.getState().profile?.user_id || null;
      // Use our custom Vite API route which uses the service_role key
      // This bypasses the "Allow new users to sign up" toggle in Supabase
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...userData, created_by: createdById }),
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
      const oldUser = get().users.find((u) => u.user_id === id);
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

      // Log each changed field
      if (oldUser) {
        const loggableKeys = ['full_name', 'username', 'role', 'is_active', 'assigned_store_id'] as const;
        for (const key of loggableKeys) {
          if (key in data) {
            const oldVal = String((oldUser as any)[key] ?? '');
            const newVal = String((data as any)[key] ?? '');
            if (oldVal !== newVal) {
              await get().addLogEntry({
                entity: 'User',
                entityLabel: oldUser.full_name,
                field: key,
                oldValue: oldVal,
                newValue: newVal,
              });
            }
          }
        }
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
      const deletedUser = get().users.find((u) => u.user_id === id);
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to delete user' };
      }
      // Log deletion
      if (deletedUser) {
        await get().addLogEntry({
          entity: 'User',
          entityLabel: deletedUser.full_name,
          field: '[DELETED]',
          oldValue: `${deletedUser.username} (${deletedUser.role})`,
          newValue: '',
        });
      }
      set((s) => ({ users: s.users.filter((u) => u.user_id !== id) }));
      get().addToast('success', 'User deleted');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  resetUserPassword: async (id, newPassword?: string) => {
    try {
      const targetUser = get().users.find((u) => u.user_id === id);
      const response = await fetch(`/api/users/${id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPassword || null }),
      });
      const result = await response.json();
      if (!response.ok) {
        get().addToast('error', result.error || 'Failed to reset password');
        return { error: result.error || 'Failed to reset password' };
      }
      // Log password reset
      if (targetUser) {
        await get().addLogEntry({
          entity: 'User',
          entityLabel: targetUser.full_name,
          field: 'password',
          oldValue: '(hidden)',
          newValue: '[RESET]',
        });
      }
      get().addToast('success', 'Password reset to Sales12345');
      return { error: null };
    } catch (err) {
      get().addToast('error', (err as Error).message);
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

  // ---------- PLU Categories ----------
  pluCategories: [],
  pluCategoriesLoading: false,

  fetchPluCategories: async () => {
    set({ pluCategoriesLoading: true });
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('plu_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      const mapped = (data as any[] ?? []).map((cat) => ({
        ...cat,
      })) as PluCategory[];
      set({ pluCategories: mapped });
    } catch (err) {
      console.error('fetchPluCategories error:', err);
      get().addToast('error', 'Failed to load categories');
    } finally {
      set({ pluCategoriesLoading: false });
    }
  },

  addPluCategory: async (name) => {
    try {
      // Import/fetch auth profile to check who is creating the category
      const { useAuthStore } = await import('./authStore');
      const userId = useAuthStore.getState().profile?.user_id || null;

      const response = await fetch('/api/plu_categories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, created_by: userId }),
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to create category' };
      }
      // Refresh list
      await get().fetchPluCategories();
      get().addToast('success', `Category "${name}" created`);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updatePluCategory: async (id, name) => {
    try {
      const oldCat = get().pluCategories.find((c) => c.category_id === id);
      const response = await fetch(`/api/plu_categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to update category' };
      }
      if (oldCat && oldCat.name !== name) {
        await get().addLogEntry({
          entity: 'Category',
          entityLabel: oldCat.name,
          field: 'name',
          oldValue: oldCat.name,
          newValue: name,
        });
      }
      // Refresh list
      await get().fetchPluCategories();
      get().addToast('success', `Category "${name}" updated`);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  deletePluCategory: async (id) => {
    try {
      const deletedCat = get().pluCategories.find((c) => c.category_id === id);
      const response = await fetch(`/api/plu_categories/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to delete category' };
      }
      // Log deletion
      if (deletedCat) {
        await get().addLogEntry({
          entity: 'Category',
          entityLabel: deletedCat.name,
          field: '[DELETED]',
          oldValue: deletedCat.name,
          newValue: '',
        });
      }
      // Refresh list
      await get().fetchPluCategories();
      get().addToast('success', 'Category deleted');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- PLU ----------
  plusItems: [],
  plusLoading: false,

  fetchPlus: async () => {
    set({ plusLoading: true });
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('plu')
        .select('*, plu_categories(name)')
        .order('plu_number');
      if (error) throw error;
      const mapped = (data ?? []).map((item: any) => ({
        ...item,
        category_name: item.plu_categories?.name ?? null,
        plu_categories: undefined,
      })) as Plu[];
      set({ plusItems: mapped });
    } catch (err) {
      console.error('fetchPlus error:', err);
      get().addToast('error', 'Failed to load PLUs');
    } finally {
      set({ plusLoading: false });
    }
  },

  addPlu: async (data) => {
    try {
      const supabase = getSupabaseClient();
      const { useAuthStore } = await import('./authStore');
      const userId = useAuthStore.getState().profile?.user_id || null;
      // Check uniqueness
      const { count } = await supabase
        .from('plu')
        .select('plu_id', { count: 'exact', head: true })
        .eq('plu_number', data.plu_number);
      if ((count ?? 0) > 0) {
        return { error: `PLU number "${data.plu_number}" already exists. Please use a different number.` };
      }
      const { data: inserted, error } = await supabase
        .from('plu')
        .insert({ ...data, created_by: userId })
        .select('*, plu_categories(name)')
        .single();
      if (error) return { error: error.message };
      const newItem = {
        ...inserted,
        category_name: (inserted as any).plu_categories?.name ?? null,
        plu_categories: undefined,
      } as Plu;
      set((s) => ({ plusItems: [...s.plusItems, newItem] }));
      get().addToast('success', `PLU "${data.plu_number}, ${data.name}" created`);

      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updatePlu: async (id, data) => {
    try {
      const supabase = getSupabaseClient();
      const oldPlu = get().plusItems.find((p) => p.plu_id === id);
      // If plu_number is changing, check uniqueness
      if (data.plu_number) {
        const { count } = await supabase
          .from('plu')
          .select('plu_id', { count: 'exact', head: true })
          .eq('plu_number', data.plu_number)
          .neq('plu_id', id);
        if ((count ?? 0) > 0) {
          return { error: `PLU number "${data.plu_number}" already exists.` };
        }
      }
      const { error } = await supabase.from('plu').update(data).eq('plu_id', id);
      if (error) return { error: error.message };
      // Log each changed field
      if (oldPlu) {
        for (const key of Object.keys(data) as (keyof typeof data)[]) {
          const oldVal = String((oldPlu as any)[key] ?? '');
          const newVal = String((data as any)[key] ?? '');
          if (oldVal !== newVal) {
            await get().addLogEntry({
              entity: 'PLU',
              entityLabel: `${oldPlu.plu_number}, ${oldPlu.name}`,

              field: key as string,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        }
      }
      // Refresh category name if category changed
      await get().fetchPlus();
      get().addToast('success', 'PLU updated successfully');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  deletePlu: async (id) => {
    try {
      const supabase = getSupabaseClient();
      const deletedPlu = get().plusItems.find((p) => p.plu_id === id);
      const { error } = await supabase.from('plu').delete().eq('plu_id', id);
      if (error) return { error: error.message };
      // Log deletion
      if (deletedPlu) {
        await get().addLogEntry({
          entity: 'PLU',
          entityLabel: `${deletedPlu.plu_number}, ${deletedPlu.name}`,
          field: '[DELETED]',
          oldValue: `${deletedPlu.plu_number} - ${deletedPlu.name}`,
          newValue: '',
        });
      }
      set((s) => ({ plusItems: s.plusItems.filter((p) => p.plu_id !== id) }));
      get().addToast('success', 'PLU deleted');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  getNextPluNumber: async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('plu')
        .select('plu_number')
        .order('created_at', { ascending: false });
      const nums = (data ?? []).map((r: any) => parseInt(r.plu_number, 10)).filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return String(max + 1).padStart(3, '0');
    } catch {
      return '001';
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

  // ---------- Logbook ----------
  logEntries: [],
  logbookLoading: false,

  fetchLogbook: async () => {
    set({ logbookLoading: true });
    try {
      const res = await fetch('/api/logbook');
      if (!res.ok) { console.error('Failed to fetch logbook', res.status); return; }
      const rows = await res.json() as any[];
      const mapped: LogEntry[] = rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        entity: r.entity,
        entityLabel: r.entity_label,
        field: r.field,
        oldValue: r.old_value ?? '',
        newValue: r.new_value ?? '',
        username: r.username,
      }));
      set({ logEntries: mapped });
    } catch (err) {
      console.error('fetchLogbook error:', err);
    } finally {
      set({ logbookLoading: false });
    }
  },

  addLogEntry: async (entry) => {
    const { useAuthStore } = await import('./authStore');
    const username = useAuthStore.getState().profile?.username ?? 'Unknown';
    const newEntry: LogEntry = {
      id: String(++logId),
      timestamp: new Date().toISOString(),
      username,
      ...entry,
    };
    // Optimistic local update
    set((s) => ({ logEntries: [newEntry, ...s.logEntries] }));
    // Persist to Supabase via server endpoint (fire and forget)
    try {
      await fetch('/api/logbook/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, username }),
      });
    } catch {
      // Non-critical — local entry already added
    }
  },

  exportLogCsv: () => {
    const entries = get().logEntries;
    const headers = ['Date/Time', 'User', 'Entity', 'Record', 'Field', 'Old Value', 'New Value'];
    const rows = entries.map((e) => [
      new Date(e.timestamp).toLocaleString('en-GB'),
      e.username,
      e.entity,
      e.entityLabel,
      e.field,
      e.oldValue,
      e.newValue,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    // \uFEFF = UTF-8 BOM so Excel opens with correct encoding
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `change_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ---------- PLU Scheduled Changes ----------
  schedulePluChange: async (pluId, payload, scheduledAt, createdBy) => {
    try {
      const res = await fetch('/api/plu_scheduled_changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plu_id: pluId, payload, scheduled_at: scheduledAt, created_by: createdBy }),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to schedule change' };
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  applyDueScheduledChanges: async () => {
    try {
      const res = await fetch('/api/plu_scheduled_changes/due');
      if (!res.ok) return;
      const due = await res.json() as any[];
      if (!due.length) return;
      for (const sc of due) {
        const { error } = await get().updatePlu(sc.plu_id, sc.payload);
        if (!error) {
          // Mark applied
          await fetch(`/api/plu_scheduled_changes/${sc.id}/applied`, { method: 'PUT' });
          get().addToast('success', `Scheduled PLU change applied ✔`);
        }
      }
    } catch (err) {
      console.error('applyDueScheduledChanges error:', err);
    }
  },
}));
