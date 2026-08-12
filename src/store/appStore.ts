// src/store/appStore.ts
import { create } from 'zustand';
import type { Store, UserProfile, InventoryItem, Toast, PluCategory, Plu, Supplier, PurchaseOrder, ItemSizing, SupplierProductWithPlu, SuggestedPO, LoyaltyCard, CurrencyConfig, LoyaltyNotification } from '../types';
import { getSupabaseClient } from '../lib/supabaseClient';
import { useAuthStore } from './authStore';

function getActiveSchema(): string | undefined {
  const auth = useAuthStore.getState();
  return auth.activeTenantSchema || (auth.user?.user_metadata?.tenant_schema as string | undefined);
}

function getClient() {
  const schema = getActiveSchema();
  return getSupabaseClient(schema);
}

function apiFetch(path: string, options?: RequestInit) {
  const schema = getActiveSchema();
  const separator = path.includes('?') ? '&' : '?';
  const url = schema ? `${path}${separator}tenant_schema=${encodeURIComponent(schema)}` : path;
  const headers = new Headers(options?.headers);
  const token = useAuthStore.getState().session?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const posToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pos_token') : null;
  if (posToken) headers.set('X-POS-Token', posToken);
  return fetch(url, { ...options, headers });
}

export interface LogEntry {
  id: string;
  timestamp: string;       // ISO
  entity: string;          // 'PLU' | 'Store' | 'Category' | 'User'
  entityLabel: string;     // human-readable name/number
  field: string;           // field that changed
  oldValue: string;
  newValue: string;
  username: string;        // who made the change
  action?: 'create' | 'edit' | 'delete';
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
    username: string;
    full_name: string;
    role: 'admin' | 'user';
    pin: string;
    assigned_store_id: string | null;
  }) => Promise<{ error: string | null }>;
  updateUser: (id: string, data: Partial<UserProfile>) => Promise<{ error: string | null }>;
  deleteUser: (id: string) => Promise<{ error: string | null }>;
  resetUserPassword: (id: string, newPassword?: string) => Promise<{ error: string | null }>;
  resendInvite: (id: string) => Promise<{ error: string | null; method?: string }>;

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
  applyDueScheduledChanges: () => Promise<void>;

  // Suppliers
  suppliers: Supplier[];
  suppliersLoading: boolean;
  fetchSuppliers: () => Promise<void>;
  addSupplier: (data: Omit<Supplier, 'supplier_id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<{ error: string | null }>;

  // Item Sizing
  itemSizing: ItemSizing[];
  itemSizingLoading: boolean;
  fetchItemSizing: () => Promise<void>;
  createItemSizing: (data: { unit_type: 'each' | 'kg'; units_per_pack: number; packs_per_case: number }) => Promise<{ error: string | null }>;
  updateItemSizing: (id: string, data: { unit_type: 'each' | 'kg'; units_per_pack: number; packs_per_case: number }) => Promise<{ error: string | null }>;
  deleteItemSizing: (id: string) => Promise<{ error: string | null }>;

  // Purchase Orders
  purchaseOrders: PurchaseOrder[];
  purchaseOrdersLoading: boolean;
  fetchPurchaseOrders: () => Promise<void>;
  savePoDraft: (data: { supplier_id: string; store_id: string; items: { plu_id: string; quantity_ordered: number; cost_price_at_order: number }[]; created_by?: string }) => Promise<{ error: string | null }>;
  lockPurchaseOrder: (id: string) => Promise<{ error: string | null }>;

  // PO Auto-Suggestions
  poSuggestions: SuggestedPO[];
  poSuggestionsLoading: boolean;
  fetchPoSuggestions: (storeId: string) => Promise<void>;
  clearSuggestions: () => void;

  // Supplier Products
  supplierProducts: SupplierProductWithPlu[];
  supplierProductsLoading: boolean;
  fetchSupplierProducts: (supplierId: string) => Promise<void>;
  linkSupplierProduct: (data: { supplier_id: string; plu_id: string; supplier_sku?: string; cost_price: number; is_preferred: boolean; lead_time_days: number }) => Promise<{ error: string | null }>;
  unlinkSupplierProduct: (id: string) => Promise<{ error: string | null }>;

  // Clock
  clockStatus: any[];
  clockStatusLoading: boolean;
  fetchClockStatus: (userId: string, pin?: string) => Promise<void>;
  clockIn: (storeId: string, userId: string, pin?: string) => Promise<{ error: string | null }>;
  clockOut: (userId: string, pin?: string) => Promise<{ error: string | null }>;

  // Checklists (POS)
  checklists: any[];
  checklistsLoading: boolean;
  fetchChecklists: (storeId: string, type?: string) => Promise<void>;

  // Checklists (HO)
  addChecklistTask: (data: { store_id: string; type: string; task_name: string; sort_order?: number }) => Promise<{ error: string | null }>;
  updateChecklistTask: (id: string, data: { task_name?: string; sort_order?: number; type?: string }) => Promise<{ error: string | null }>;
  deleteChecklistTask: (id: string) => Promise<{ error: string | null }>;

  // Goods In
  pendingPOs: any[];
  pendingPOsLoading: boolean;
  fetchPendingPOs: (storeId: string) => Promise<void>;
  receiveDelivery: (poId: string, items: { plu_id: string; qty_received: number }[], pin: string) => Promise<{ error: string | null }>;

  // Currency Config
  currencyConfig: CurrencyConfig | null;
  fetchCurrencyConfig: () => Promise<void>;
  updateCurrencyConfig: (config: CurrencyConfig) => Promise<void>;

  // Loyalty Cards
  loyaltyCards: LoyaltyCard[];
  loyaltyCardsLoading: boolean;
  fetchLoyaltyCards: () => Promise<void>;
  createLoyaltyCard: (data: { customer_name: string; phone?: string; email?: string; postcode?: string; cashback_balance?: number; store_id?: string }) => Promise<{ card_number?: string } | undefined>;
  updateLoyaltyCard: (id: string, data: Partial<LoyaltyCard>) => Promise<void>;
  lookupLoyaltyCard: (code: string) => Promise<LoyaltyCard | null>;

  // Cashback Percent
  cashbackPercent: number | null;
  fetchCashbackPercent: () => Promise<void>;
  updateCashbackPercent: (percent: number) => Promise<void>;

  // Loyalty Notifications
  loyaltyNotifications: LoyaltyNotification[];
  loyaltyNotificationsLoading: boolean;
  fetchLoyaltyNotifications: () => Promise<void>;
  createNotification: (data: { title: string; body: string; store_id?: string }) => Promise<{ error: string | null; notification: LoyaltyNotification | null }>;
  sendNotification: (id: string) => Promise<{ error: string | null }>;
  unseenNotifications: LoyaltyNotification[];
  fetchUnseenNotifications: (storeId: string) => Promise<void>;

  // Basket / Cart
  basketTabs: BasketTab[];
  activeTabId: string | null;
  openNewBasket: (staffUserId: string, staffName: string, staffPin?: string | null) => void;
  switchBasket: (tabId: string) => void;
  closeBasket: (tabId: string) => void;
  addToBasket: (item: BasketItem) => void;
  updateBasketItemQty: (pluId: string, qty: number) => void;
  removeFromBasket: (pluId: string) => void;
  setBasketDiscount: (tabId: string, amount: number) => void;
  setBasketLoyalty: (tabId: string, cardId: string, customerName: string, cashback: number) => void;

  // Sales
  saleTransactions: any[];
  saleTransactionsLoading: boolean;
  fetchSaleTransactions: (storeId: string, date?: string) => Promise<void>;
  createSale: (data: any) => Promise<{ error: string | null; transaction?: any }>;
  voidSale: (transactionId: string) => Promise<{ error: string | null }>;
}


let toastId = 0;
let logId = 0;

export interface BasketItem {
  plu_id: string;
  plu_number: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  uses_scale: boolean;
}

export interface BasketTab {
  tabId: string;
  staffUserId: string;
  staffName: string;
  staffPin: string | null;
  items: BasketItem[];
  discount: number;
  loyaltyCardId: string | null;
  loyaltyCustomerName: string | null;
  loyaltyCashback: number;
}

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
      const supabase = getClient();
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
      const supabase = getClient();
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
      const logFields: { field: string; value: string }[] = [
        { field: 'name', value: store.name },
        { field: 'address', value: store.address },
        { field: 'postcode', value: store.postcode },
        { field: 'vat_number', value: store.vat_number },
        { field: 'store_number', value: nextStoreNumber },
      ];
      if (store.is_active !== undefined) {
        logFields.push({ field: 'is_active', value: String(store.is_active) });
      }
      for (const { field, value } of logFields) {
        await get().addLogEntry({
          entity: 'Store',
          entityLabel: store.name,
          field,
          oldValue: '',
          newValue: value,
          action: 'create',
        });
      }
      get().addToast('success', `Store "${store.name}" (No. ${nextStoreNumber}) created successfully`);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updateStore: async (id, data) => {
    try {
      const supabase = getClient();
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
          const newVal = String(data[key] ?? '');
          if (oldVal !== newVal) {
            await get().addLogEntry({
              entity: 'Store',
              entityLabel: oldStore.name,
              field: key as string,
              oldValue: oldVal,
              newValue: newVal,
              action: 'edit',
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
      const supabase = getClient();
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
          action: 'delete',
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
      const supabase = getClient();
      const { data, error } = await supabase
        .from('users')
        .select('*, stores!assigned_store_id(name)')
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
      const auth = useAuthStore.getState();
      const createdById = auth.profile?.user_id || null;
      const tenantSchema = getActiveSchema() as string;
      const response = await apiFetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...userData, created_by: createdById, tenant_schema: tenantSchema }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { error: result.error || 'Failed to create user' };
      }

      const logFields: { field: string; value: string }[] = [
        { field: 'username', value: userData.username },
        { field: 'full_name', value: userData.full_name },
        { field: 'role', value: userData.role },
      ];
      if (userData.assigned_store_id) {
        logFields.push({ field: 'assigned_store_id', value: userData.assigned_store_id });
      }
      for (const { field, value } of logFields) {
        await get().addLogEntry({
          entity: 'User',
          entityLabel: userData.full_name || userData.username,
          field,
          oldValue: '',
          newValue: value,
          action: 'create',
        });
      }
      get().addToast('success', `User "${userData.username}" created - verification email sent`);
      await get().fetchUsers();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updateUser: async (id, data) => {
    try {
      const oldUser = get().users.find((u) => u.user_id === id);
      const tenantSchema = getActiveSchema() as string;
      const response = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, tenant_schema: tenantSchema }),
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
            const oldVal = String(oldUser[key as keyof typeof oldUser] ?? '');
            const newVal = String(data[key as keyof typeof data] ?? '');
            if (oldVal !== newVal) {
              await get().addLogEntry({
                entity: 'User',
                entityLabel: oldUser.full_name,
                field: key,
                oldValue: oldVal,
                newValue: newVal,
                action: 'edit',
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
      const response = await apiFetch(`/api/users/${id}`, {
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
          action: 'delete',
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
      const tenantSchema = getActiveSchema() as string;
      const response = await apiFetch(`/api/users/${id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPassword || null, tenant_schema: tenantSchema }),
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
          action: 'edit',
        });
      }
      get().addToast('success', 'Password reset successfully');
      return { error: null };
    } catch (err) {
      get().addToast('error', (err as Error).message);
      return { error: (err as Error).message };
    }
  },

  resendInvite: async (id) => {
    try {
      const tenantSchema = getActiveSchema() as string;
      const response = await apiFetch(`/api/users/${id}/resend-invite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_schema: tenantSchema }),
      });
      const result = await response.json();
      if (!response.ok) {
        get().addToast('error', result.error || 'Failed to send email');
        return { error: result.error || 'Failed to send email' };
      }
      get().addToast('success', result.method === 'recovery' ? 'Password reset email sent' : 'Verification email sent');
      return { error: null, method: result.method };
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
      const supabase = getClient();
      let { data, error } = await supabase
        .from('inventory')
        .select('*, stores(name), plu(plu_id, plu_number, name, plu_categories(name))');
      if (error) {
        // Pre-migration fallback: plu_id column not added yet (008)
        ({ data, error } = await supabase.from('inventory').select('*, stores(name)'));
      }
      if (error) throw error;
      const mapped = (data ?? []).map((item: any) => ({
        ...item,
        store_name: item.stores?.name ?? 'Unknown',
        product_name: item.plu?.name ?? item.name,
        plu_number: item.plu?.plu_number ?? '',
        category_name: item.plu?.plu_categories?.name ?? '',
        stores: undefined,
        plu: undefined,
      })) as InventoryItem[];
      mapped.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));
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
      const supabase = getClient();
      const { data, error } = await supabase
        .from('plu_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      const userIds = [...new Set(((data as unknown) as PluCategory[] ?? []).map((c) => c.created_by).filter(Boolean))];
      let userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('user_id, username')
          .in('user_id', userIds);
        if (users) {
          userMap = new Map(users.map((u: any) => [u.user_id, u.username]));
        }
      }
      const mapped = ((data as unknown) as PluCategory[] ?? []).map((cat) => ({
        ...cat,
        creator_username: cat.created_by ? (userMap.get(cat.created_by) ?? null) : null,
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
      const profile = useAuthStore.getState().profile;
      const userId = profile?.user_id || null;
      const response = await apiFetch('/api/plu_categories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, created_by: userId }),
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to create category' };
      }
      await get().addLogEntry({
        entity: 'Category',
        entityLabel: name,
        field: 'name',
        oldValue: '',
        newValue: name,
        action: 'create',
      });
      // Refresh categories
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
      const response = await apiFetch(`/api/plu_categories/${id}`, {
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
          action: 'edit',
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
      const response = await apiFetch(`/api/plu_categories/${id}`, {
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
          action: 'delete',
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
      const supabase = getClient();
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
      const userId = useAuthStore.getState().profile?.user_id || null;

      const response = await apiFetch('/api/plu/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, created_by: userId }),
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to create PLU' };
      }
      const pluLogFields: { field: string; value: string }[] = [
        { field: 'plu_number', value: data.plu_number },
        { field: 'name', value: data.name },
      ];
      if (data.category_id) pluLogFields.push({ field: 'category_id', value: data.category_id });
      if (data.vat_class) pluLogFields.push({ field: 'vat_class', value: data.vat_class });
      if (data.headoffice_price != null) pluLogFields.push({ field: 'headoffice_price', value: String(data.headoffice_price) });
      for (const { field, value } of pluLogFields) {
        await get().addLogEntry({
          entity: 'PLU',
          entityLabel: `${data.plu_number}, ${data.name}`,
          field,
          oldValue: '',
          newValue: value,
          action: 'create',
        });
      }
      // Refresh list
      await get().fetchPlus();
      get().addToast('success', `PLU "${data.plu_number}, ${data.name}" created`);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updatePlu: async (id, data) => {
    try {
      const username = useAuthStore.getState().profile?.username ?? 'system';
      const payload = { ...data, username };
      const response = await apiFetch(`/api/plu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to update PLU' };
      }
      // Refresh list after successful update
      await get().fetchPlus();
      get().addToast('success', 'PLU has been updated.');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  deletePlu: async (id) => {
    try {
      const deletedPlu = get().plusItems.find((p) => p.plu_id === id);
      const response = await apiFetch(`/api/plu/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        return { error: result.error || 'Failed to delete PLU' };
      }
      // Optimistically remove from local state
      set((s) => ({ plusItems: s.plusItems.filter((p) => p.plu_id !== id) }));
      // Log deletion
      if (deletedPlu) {
        await get().addLogEntry({
          entity: 'PLU',
          entityLabel: `${deletedPlu.plu_number}, ${deletedPlu.name}`,
          field: '[DELETED]',
          oldValue: `${deletedPlu.plu_number} (${deletedPlu.name})`,
          newValue: '',
          action: 'delete',
        });
      }
      get().addToast('success', 'PLU deleted');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  getNextPluNumber: async () => {
    try {
      const supabase = getClient();
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
      const res = await apiFetch('/api/logbook');
      if (!res.ok) { console.error('Failed to fetch logbook', res.status); return; }
      const rows = await res.json();
      type LogbookRow = { id: string; timestamp: string; entity: string; entity_label: string; field: string; old_value: string | null; new_value: string | null; username: string; action?: string | null };
      const seen = new Set<string>();
      const mapped: LogEntry[] = (rows as LogbookRow[]).filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      }).map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        entity: r.entity,
        entityLabel: r.entity_label,
        field: r.field,
        oldValue: r.old_value ?? '',
        newValue: r.new_value ?? '',
        username: r.username,
        action: r.action
          ? (r.action as 'create' | 'edit' | 'delete')
          : (r.field === '[DELETED]' ? 'delete' as const : 'edit' as const),
      }));
      set({ logEntries: mapped });
    } catch (err) {
      console.error('fetchLogbook error:', err);
    } finally {
      set({ logbookLoading: false });
    }
  },

  addLogEntry: async (entry) => {
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
      await apiFetch('/api/logbook/create', {
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
    const headers = ['Date/Time', 'User', 'Action', 'Entity', 'Record', 'Field', 'Old Value', 'New Value'];
    const rows = entries.map((e) => [
      new Date(e.timestamp).toLocaleString('en-GB'),
      e.username,
      e.action || 'edit',
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
  applyDueScheduledChanges: async () => {
    try {
      const res = await apiFetch('/api/plu_scheduled_changes/due');
      if (!res.ok) return;
      const due = await res.json() as { id: string; plu_id: string; payload: Record<string, unknown> }[];
      if (!due.length) return;
      for (const sc of due) {
        const { error } = await get().updatePlu(sc.plu_id, sc.payload);
        if (!error) {
          // Mark applied
          await apiFetch(`/api/plu_scheduled_changes/${sc.id}/applied`, { method: 'PUT' });
          get().addToast('success', `Scheduled PLU change applied ✔`);
        }
      }
    } catch {
      // Network errors expected during server restart — retry next interval
    }
  },

  // ---------- Suppliers ----------
  suppliers: [],
  suppliersLoading: false,

  fetchSuppliers: async () => {
    set({ suppliersLoading: true });
    try {
      const res = await apiFetch('/api/suppliers');
      if (!res.ok) throw new Error('Failed to load suppliers');
      const data = await res.json();
      set({ suppliers: data });
    } catch (err) {
      console.error('fetchSuppliers error:', err);
      get().addToast('error', 'Failed to load suppliers');
    } finally {
      set({ suppliersLoading: false });
    }
  },

  addSupplier: async (data) => {
    try {
      const username = useAuthStore.getState().profile?.username ?? 'system';
      const payload = { ...data, username };
      const res = await apiFetch('/api/suppliers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to create supplier' };
      get().addToast('success', `Supplier "${data.name}" created`);
      await get().fetchSuppliers();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updateSupplier: async (id, data) => {
    try {
      const username = useAuthStore.getState().profile?.username ?? 'system';
      const payload = { ...data, username };
      const res = await apiFetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to update supplier' };
      get().addToast('success', `Supplier updated successfully`);
      await get().fetchSuppliers();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- Item Sizing ----------
  itemSizing: [],
  itemSizingLoading: false,

  fetchItemSizing: async () => {
    set({ itemSizingLoading: true });
    try {
      const res = await apiFetch('/api/item-sizing');
      if (!res.ok) throw new Error('Failed to load item sizing');
      const data = await res.json();
      set({ itemSizing: data });
    } catch (err) {
      console.error('fetchItemSizing error:', err);
      get().addToast('error', 'Failed to load item sizing');
    } finally {
      set({ itemSizingLoading: false });
    }
  },

  createItemSizing: async (sizingData) => {
    try {
      const res = await apiFetch('/api/item-sizing/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sizingData),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to create item sizing' };
      const name = `${sizingData.packs_per_case} × ${sizingData.units_per_pack} ${sizingData.unit_type}`;
      const logFields = [
        { field: 'unit_type', value: sizingData.unit_type },
        { field: 'units_per_pack', value: String(sizingData.units_per_pack) },
        { field: 'packs_per_case', value: String(sizingData.packs_per_case) },
      ];
      for (const { field, value } of logFields) {
        await get().addLogEntry({
          entity: 'Item Sizing',
          entityLabel: name,
          field,
          oldValue: '',
          newValue: value,
          action: 'create',
        });
      }
      get().addToast('success', 'Item sizing created');
      await get().fetchItemSizing();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updateItemSizing: async (id, sizingData) => {
    try {
      const old = get().itemSizing.find((s) => s.id === id);
      const res = await apiFetch(`/api/item-sizing/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sizingData),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to update item sizing' };
      if (old) {
        const loggableKeys = ['unit_type', 'units_per_pack', 'packs_per_case'] as const;
        for (const key of loggableKeys) {
          if (String(old[key]) !== String(sizingData[key])) {
            await get().addLogEntry({
              entity: 'Item Sizing',
              entityLabel: `${old.packs_per_case} × ${old.units_per_pack} ${old.unit_type}`,
              field: key,
              oldValue: String(old[key]),
              newValue: String(sizingData[key]),
              action: 'edit',
            });
          }
        }
      }
      get().addToast('success', 'Item sizing updated');
      await get().fetchItemSizing();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  deleteItemSizing: async (id) => {
    try {
      const deleted = get().itemSizing.find((s) => s.id === id);
      const res = await apiFetch(`/api/item-sizing/${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to delete item sizing' };
      if (deleted) {
        await get().addLogEntry({
          entity: 'Item Sizing',
          entityLabel: `${deleted.packs_per_case} × ${deleted.units_per_pack} ${deleted.unit_type}`,
          field: '[DELETED]',
          oldValue: `${deleted.packs_per_case} × ${deleted.units_per_pack} ${deleted.unit_type}`,
          newValue: '',
          action: 'delete',
        });
      }
      set((s) => ({ itemSizing: s.itemSizing.filter((sizing) => sizing.id !== id) }));
      get().addToast('success', 'Item sizing deleted');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- Purchase Orders ----------
  purchaseOrders: [],
  purchaseOrdersLoading: false,

  fetchPurchaseOrders: async () => {
    set({ purchaseOrdersLoading: true });
    try {
      const res = await apiFetch('/api/purchase-orders');
      if (!res.ok) throw new Error('Failed to load purchase orders');
      const data = await res.json();
      set({ purchaseOrders: data });
    } catch (err) {
      console.error('fetchPurchaseOrders error:', err);
      get().addToast('error', 'Failed to load purchase orders');
    } finally {
      set({ purchaseOrdersLoading: false });
    }
  },

  savePoDraft: async (data) => {
    try {
      const res = await apiFetch('/api/purchase-orders/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to save PO draft' };
      get().addToast('success', `Purchase order draft saved`);
      await get().fetchPurchaseOrders();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  lockPurchaseOrder: async (id) => {
    try {
      const res = await apiFetch(`/api/purchase-orders/${id}/lock`, {
        method: 'PUT',
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to finalize purchase order' };
      get().addToast('success', `Purchase order locked & finalized`);
      await get().fetchPurchaseOrders();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- PO Auto-Suggestions ----------
  poSuggestions: [],
  poSuggestionsLoading: false,

  fetchPoSuggestions: async (storeId) => {
    set({ poSuggestionsLoading: true, poSuggestions: [] });
    try {
      const res = await apiFetch('/api/purchase-orders/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId }),
      });
      if (!res.ok) throw new Error('Failed to generate suggestions');
      const data = await res.json();
      set({ poSuggestions: data.suggestions ?? [] });
    } catch (err) {
      console.error('fetchPoSuggestions error:', err);
      get().addToast('error', 'Failed to generate PO suggestions');
    } finally {
      set({ poSuggestionsLoading: false });
    }
  },

  clearSuggestions: () => {
    set({ poSuggestions: [] });
  },

  // ---------- Supplier Products ----------
  supplierProducts: [],
  supplierProductsLoading: false,

  fetchSupplierProducts: async (supplierId) => {
    set({ supplierProductsLoading: true });
    try {
      const res = await apiFetch(`/api/supplier-products?supplier_id=${encodeURIComponent(supplierId)}`);
      if (!res.ok) throw new Error('Failed to load supplier products');
      const data = await res.json();
      set({ supplierProducts: data });
    } catch (err) {
      console.error('fetchSupplierProducts error:', err);
      get().addToast('error', 'Failed to load supplier products');
    } finally {
      set({ supplierProductsLoading: false });
    }
  },

  linkSupplierProduct: async (data) => {
    try {
      const res = await apiFetch('/api/supplier-products/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to link product' };
      get().addToast('success', 'Product linked to supplier');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  unlinkSupplierProduct: async (id) => {
    try {
      const res = await apiFetch(`/api/supplier-products/${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to unlink product' };
      get().addToast('success', 'Product unlinked from supplier');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- Clock ----------
  clockStatus: [],
  clockStatusLoading: false,

  fetchClockStatus: async (userId, pin?) => {
    set({ clockStatusLoading: true });
    try {
      let url = `/api/pos/clock-status?user_id=${encodeURIComponent(userId)}`;
      if (pin) url += `&pin=${encodeURIComponent(pin)}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Failed to fetch clock status');
      const data = await res.json();
      set({ clockStatus: data });
    } catch (err) {
      console.error('fetchClockStatus error:', err);
    } finally {
      set({ clockStatusLoading: false });
    }
  },

  clockIn: async (storeId, userId, pin?) => {
    try {
      const res = await apiFetch('/api/pos/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, user_id: userId, ...(pin ? { pin } : {}) }),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to clock in' };
      get().addToast('success', 'Clocked in');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  clockOut: async (userId, pin?) => {
    try {
      const res = await apiFetch('/api/pos/clock-out', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...(pin ? { pin } : {}) }),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to clock out' };
      get().addToast('success', 'Clocked out');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- Checklists (POS) ----------
  checklists: [],
  checklistsLoading: false,

  fetchChecklists: async (storeId, type) => {
    set({ checklistsLoading: true });
    try {
      let url = `/api/checklists?store_id=${encodeURIComponent(storeId)}`;
      if (type) url += `&type=${encodeURIComponent(type)}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Failed to fetch checklists');
      const data = await res.json();
      set({ checklists: data });
    } catch (err) {
      console.error('fetchChecklists error:', err);
    } finally {
      set({ checklistsLoading: false });
    }
  },

  // ---------- Checklists (HO) ----------
  addChecklistTask: async (data) => {
    try {
      const res = await apiFetch('/api/checklists/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to create task' };
      get().addToast('success', 'Checklist task created');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  updateChecklistTask: async (id, data) => {
    try {
      const res = await apiFetch(`/api/checklists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to update task' };
      get().addToast('success', 'Checklist task updated');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  deleteChecklistTask: async (id) => {
    try {
      const res = await apiFetch(`/api/checklists/${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to delete task' };
      get().addToast('success', 'Checklist task deleted');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- Goods In ----------
  pendingPOs: [],
  pendingPOsLoading: false,

  fetchPendingPOs: async (storeId) => {
    set({ pendingPOsLoading: true });
    try {
      const res = await apiFetch(`/api/purchase-orders/pending?store_id=${encodeURIComponent(storeId)}`);
      if (!res.ok) throw new Error('Failed to fetch pending POs');
      const data = await res.json();
      set({ pendingPOs: data });
    } catch (err) {
      console.error('fetchPendingPOs error:', err);
      get().addToast('error', 'Failed to load pending deliveries');
    } finally {
      set({ pendingPOsLoading: false });
    }
  },

  receiveDelivery: async (poId, items, pin) => {
    try {
      const res = await apiFetch('/api/purchase-orders/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_id: poId, items, pin }),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Failed to receive delivery' };
      get().addToast('success', 'Delivery received');
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  // ---------- Currency Config ----------
  currencyConfig: null,

  fetchCurrencyConfig: async () => {
    try {
      const res = await apiFetch('/api/settings/currency');
      if (!res.ok) return;
      const data = await res.json();
      set({ currencyConfig: data });
    } catch (err) {
      console.error('fetchCurrencyConfig error:', err);
    }
  },

  updateCurrencyConfig: async (config) => {
    try {
      const res = await apiFetch('/api/settings/currency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) return;
      set({ currencyConfig: config });
      get().addToast('success', 'Currency settings saved');
    } catch (err) {
      console.error('updateCurrencyConfig error:', err);
    }
  },

  // ---------- Loyalty Cards ----------
  loyaltyCards: [],
  loyaltyCardsLoading: false,

  fetchLoyaltyCards: async () => {
    set({ loyaltyCardsLoading: true });
    try {
      const res = await apiFetch('/api/loyalty-cards');
      if (!res.ok) throw new Error('Failed to fetch loyalty cards');
      const data = await res.json();
      set({ loyaltyCards: data });
    } catch (err) {
      console.error('fetchLoyaltyCards error:', err);
    } finally {
      set({ loyaltyCardsLoading: false });
    }
  },

  createLoyaltyCard: async (data) => {
    try {
      const res = await apiFetch('/api/loyalty-cards/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      get().addToast('success', 'Loyalty card created');
      return { card_number: result.card?.card_number };
    } catch (err) {
      console.error('createLoyaltyCard error:', err);
      get().addToast('error', 'Failed to create loyalty card');
    }
  },

  updateLoyaltyCard: async (id, data) => {
    try {
      const res = await apiFetch(`/api/loyalty-cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to update loyalty card' }));
        throw new Error(errData.error);
      }
      get().addToast('success', 'Loyalty card updated');
    } catch (err) {
      console.error('updateLoyaltyCard error:', err);
      get().addToast('error', err instanceof Error ? err.message : 'Failed to update loyalty card');
    }
  },

  lookupLoyaltyCard: async (code) => {
    try {
      const res = await apiFetch(`/api/loyalty-cards/lookup/${encodeURIComponent(code)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('lookupLoyaltyCard error:', err);
      return null;
    }
  },

  // ---------- Cashback Percent ----------
  cashbackPercent: null,

  fetchCashbackPercent: async () => {
    try {
      const res = await apiFetch('/api/settings/loyalty-cashback-percent');
      if (res.ok) {
        const data = await res.json();
        set({ cashbackPercent: data.percent });
      }
    } catch (err) {
      console.error('fetchCashbackPercent error:', err);
    }
  },

  updateCashbackPercent: async (percent) => {
    try {
      const res = await apiFetch('/api/settings/loyalty-cashback-percent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to update cashback percentage' }));
        get().addToast('error', errData.error || 'Failed to update cashback percentage');
        return;
      }
      set({ cashbackPercent: percent });
      get().addToast('success', 'Cashback percentage updated');
    } catch (err) {
      console.error('updateCashbackPercent error:', err);
      get().addToast('error', 'Failed to update cashback percentage');
    }
  },

  // ---------- Loyalty Notifications ----------
  loyaltyNotifications: [],
  loyaltyNotificationsLoading: false,
  unseenNotifications: [],

  fetchLoyaltyNotifications: async () => {
    set({ loyaltyNotificationsLoading: true });
    try {
      const res = await apiFetch('/api/loyalty-notifications');
      if (res.ok) {
        const data = await res.json();
        set({ loyaltyNotifications: data });
      }
    } catch (err) {
      console.error('fetchLoyaltyNotifications error:', err);
    } finally {
      set({ loyaltyNotificationsLoading: false });
    }
  },

  createNotification: async (data) => {
    try {
      const res = await apiFetch('/api/loyalty-notifications/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        return { error: err.error || 'Failed to create notification', notification: null };
      }
      const notification = await res.json();
      await get().fetchLoyaltyNotifications();
      return { error: null, notification: notification.notification };
    } catch {
      return { error: 'Network error', notification: null };
    }
  },

  sendNotification: async (id) => {
    try {
      const res = await apiFetch(`/api/loyalty-notifications/${id}/send`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        return { error: err.error || 'Failed to send notification' };
      }
      await get().fetchLoyaltyNotifications();
      return { error: null };
    } catch {
      return { error: 'Network error' };
    }
  },

  fetchUnseenNotifications: async (storeId) => {
    try {
      const res = await apiFetch(`/api/loyalty-notifications/unseen?store_id=${encodeURIComponent(storeId)}`);
      if (res.ok) {
        const data = await res.json();
        set({ unseenNotifications: data });
      }
    } catch (err) {
      console.error('fetchUnseenNotifications error:', err);
    }
  },

  // ---------- Basket / Cart ----------
  basketTabs: [],
  activeTabId: null,

  openNewBasket: (staffUserId, staffName, staffPin = null) => set((state) => {
    const tabId = `tab_${Date.now()}`;
    const newTab = {
      tabId,
      staffUserId,
      staffName,
      staffPin,
      items: [],
      discount: 0,
      loyaltyCardId: null as string | null,
      loyaltyCustomerName: null as string | null,
      loyaltyCashback: 0,
    };
    return {
      basketTabs: [...state.basketTabs, newTab],
      activeTabId: tabId,
    };
  }),

  switchBasket: (tabId) => set({ activeTabId: tabId }),

  closeBasket: (tabId) => set((state) => {
    const filtered = state.basketTabs.filter((t) => t.tabId !== tabId);
    return {
      basketTabs: filtered,
      activeTabId: filtered.length > 0 ? filtered[filtered.length - 1].tabId : null,
    };
  }),

  addToBasket: (item) => set((state) => {
    const tab = state.basketTabs.find((t) => t.tabId === state.activeTabId);
    if (!tab) return state;
    const qty = item.quantity ?? 1;
    const existing = tab.items.find((i: any) => i.plu_id === item.plu_id);
    if (existing) {
      existing.quantity += qty;
    } else {
      tab.items.push({ ...item, quantity: qty });
    }
    return { basketTabs: [...state.basketTabs] };
  }),

  updateBasketItemQty: (pluId, qty) => set((state) => {
    const tab = state.basketTabs.find((t) => t.tabId === state.activeTabId);
    if (!tab) return state;
    const item = tab.items.find((i: any) => i.plu_id === pluId);
    if (item) item.quantity = Math.max(0, qty);
    tab.items = tab.items.filter((i: any) => i.quantity > 0);
    return { basketTabs: [...state.basketTabs] };
  }),

  removeFromBasket: (pluId) => set((state) => {
    const tab = state.basketTabs.find((t) => t.tabId === state.activeTabId);
    if (!tab) return state;
    tab.items = tab.items.filter((i: any) => i.plu_id !== pluId);
    return { basketTabs: [...state.basketTabs] };
  }),

  setBasketDiscount: (tabId, amount) => set((state) => {
    const tab = state.basketTabs.find((t) => t.tabId === tabId);
    if (!tab) return state;
    tab.discount = Math.max(0, amount);
    return { basketTabs: [...state.basketTabs] };
  }),

  setBasketLoyalty: (tabId, cardId, customerName, cashback) => set((state) => {
    const tab = state.basketTabs.find((t) => t.tabId === tabId);
    if (!tab) return state;
    tab.loyaltyCardId = cardId;
    tab.loyaltyCustomerName = customerName;
    tab.loyaltyCashback = cashback;
    return { basketTabs: [...state.basketTabs] };
  }),

  // ---------- Sales ----------
  saleTransactions: [],
  saleTransactionsLoading: false,

  fetchSaleTransactions: async (storeId, date) => {
    set({ saleTransactionsLoading: true });
    try {
      let url = `/api/sales?store_id=${storeId}`;
      if (date) url += `&date=${date}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        set({ saleTransactions: data });
      }
    } finally {
      set({ saleTransactionsLoading: false });
    }
  },

  createSale: async (payload) => {
    try {
      const res = await apiFetch('/api/sales/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Failed to create sale' };
      await get().fetchSaleTransactions(payload.store_id);
      return { error: null, transaction: data.transaction };
    } catch {
      return { error: 'Network error' };
    }
  },

  voidSale: async (transactionId) => {
    try {
      const res = await apiFetch('/api/sales/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Failed to void' };
      return { error: null };
    } catch {
      return { error: 'Network error' };
    }
  },
}));


