// src/types/index.ts

export interface Store {
  store_id: string;
  name: string;
  address: string;
  postcode: string;
  vat_number: string;
  created_at: string;
  is_active?: boolean;
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
