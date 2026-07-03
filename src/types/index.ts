// src/types/index.ts

export interface Store {
  store_id: string;
  name: string;
  address: string;
  postcode: string;
  vat_number: string;
  created_at: string;
  created_by?: string | null;
  is_active?: boolean;
  store_number?: string | null;  // 3-digit identifier e.g. "001"
}

export interface PluCategory {
  category_id: string;
  name: string;
  created_at: string;
  created_by?: string | null;
  creator_username?: string | null;
}

export type VatClass = 'standard' | 'zero_rated' | 'exempt';

export interface Plu {
  plu_id: string;
  plu_number: string;          // unique code e.g. "001", "PROMO-10"
  name: string;
  category_id: string | null;
  vat_class: VatClass;
  uses_scale: boolean;
  ean: string | null;
  headoffice_price: number | null;
  store_001: number | null;
  store_002: number | null;
  store_003: number | null;
  store_004: number | null;
  store_005: number | null;
  store_006: number | null;
  store_007: number | null;
  store_008: number | null;
  store_009: number | null;
  created_at: string;
  created_by?: string | null;
  // Joined field
  category_name?: string;
  creator_username?: string | null;
}

export interface UserProfile {
  user_id: string;
  email?: string;
  username: string;
  full_name: string;
  role: 'super_user' | 'admin' | 'user';
  is_active: boolean;
  requires_password_change?: boolean;
  assigned_store_id: string | null;
  assigned_store_name?: string;
  created_at?: string | null;
  created_by?: string | null;
  creator_username?: string | null;
}

export interface InventoryItem {
  product_id: string;
  store_id: string;
  name: string;
  barcode_qr: string | null;
  stock_quantity: number;
  price: number;
  store_name?: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}
