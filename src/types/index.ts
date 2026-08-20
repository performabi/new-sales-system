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
  store_number?: string | null;
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
  plu_number: string;
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
  pin_hash?: string | null;
}

export interface InventoryItem {
  product_id: string;
  store_id: string;
  name: string;
  plu_id?: string | null;
  plu?: {
    plu_id: string;
    plu_number: string;
    name: string;
    plu_categories?: { name: string } | null;
  } | null;
  barcode_qr: string | null;
  stock_quantity: number;
  price: number;
  store_name?: string;
  product_name?: string;
  plu_number?: string;
  category_name?: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export interface Supplier {
  supplier_id: string;
  name: string;
  contact_email: string;
  phone?: string;
  address?: string;
  payment_terms?: string;
  vat_number?: string;
  company_reg_number?: string;
  bank_details?: {
    bank_name?: string;
    sort_code?: string;
    account_number?: string;
  };
  created_at: string;
}

export interface SupplierProduct {
  supplier_product_id: string;
  supplier_id: string;
  plu_id: string;
  supplier_sku?: string;
  cost_price: number;
  is_preferred: boolean;
  lead_time_days: number;
  created_at: string;
}

export interface PurchaseOrderItem {
  po_item_id: string;
  po_id: string;
  plu_id: string;
  quantity_ordered: number;
  cost_price_at_order: number;
  quantity_received: number;
  plu?: {
    name: string;
    plu_number: string;
  };
}

export interface ItemSizing {
  id: string;
  unit_type: 'each' | 'kg';
  units_per_pack: number;
  packs_per_case: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  po_id: string;
  po_number: string;
  supplier_id: string;
  store_id: string;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  total_cost: number;
  created_by?: string;
  created_at: string;
  downloaded_at?: string;
  received_at?: string;
  received_by?: string | null;
  expected_delivery_date?: string | null;
  delivered_date?: string | null;
  suppliers?: {
    name: string;
  };
  stores?: {
    name: string;
  };
  purchase_order_items?: PurchaseOrderItem[];
}

export interface SalesTransaction {
  transaction_id: string;
  store_id: string;
  staff_user_id: string;
  total_amount: number;
  discount_amount: number;
  payment_method: 'cash' | 'card' | 'bank_transfer';
  payment_note?: string | null;
  cash_given?: number | null;
  change_due?: number | null;
  status: 'completed' | 'void';
  loyalty_card_id?: string | null;
  created_at: string;
  users?: { full_name: string };
  sale_items?: SaleItem[];
}

export interface SaleItem {
  sale_item_id: string;
  transaction_id: string;
  plu_id?: string | null;
  plu_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface SupplierProductWithPlu extends SupplierProduct {
  plu?: {
    plu_id: string;
    plu_number: string;
    name: string;
  };
}

export interface SuggestionItem {
  plu_id: string;
  plu_number: string;
  plu_name: string;
  avg_receipt_8wk: number;
  avg_daily_sales: number;
  lead_time_days: number;
  supplier_sku?: string;
  suggested_qty: number;
}

export interface SuggestedPO {
  supplier_id: string;
  supplier_name: string;
  store_id: string;
  store_name: string;
  items: SuggestionItem[];
  total_suggested_cost: number;
}

export interface StaffTimesheet {
  timesheet_id: string;
  store_id: string;
  user_id: string;
  clock_in: string;
  clock_out?: string | null;
  created_at: string;
}

export interface StoreChecklist {
  checklist_id: string;
  store_id: string;
  type: 'start' | 'end';
  task_name: string;
  sort_order: number;
  created_at: string;
}

export interface LoyaltyCard {
  card_id: string;
  store_id?: string | null;
  store_name?: string;
  card_number: string;
  customer_name: string;
  phone?: string;
  email?: string;
  postcode?: string;
  cashback_balance: number;
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

export interface CurrencyConfig {
  symbol: string;
  code: string;
  notes: number[];
  coins: number[];
}

export interface LoyaltyNotification {
  notification_id: string;
  title: string;
  body: string;
  store_id?: string | null;
  store_name?: string;
  created_at: string;
  created_by?: string;
  sent_at?: string | null;
}

// =============================================
// Multi-Tenant System Types
// =============================================

export interface SuperUser {
  super_user_id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'support';
  is_active: boolean;
  created_at: string;
  created_by?: string | null;
}

export interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
  schema_name: string;
  domain?: string | null;
  is_active: boolean;
  plan_id?: string | null;
  created_at: string;
  created_by?: string | null;
  plan_name?: string;
  subscription_status?: string | null;
  user_count?: number;
  store_count?: number;
}

export interface TenantPlan {
  plan_id: string;
  name: string;
  description?: string | null;
  price: number;
  max_stores: number;
  max_users: number;
  features?: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface TenantSubscription {
  subscription_id: string;
  tenant_id: string;
  plan_id: string;
  status: 'active' | 'trial' | 'cancelled' | 'expired';
  starts_at: string;
  ends_at?: string | null;
  created_at: string;
}
