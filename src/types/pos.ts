export interface CartItem {
  plu_id: string;
  plu_number: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  uses_scale: boolean;
  weight_kg?: number;
}

export interface BasketTab {
  tabId: string;
  staffUserId: string;
  staffName: string;
  items: CartItem[];
  startedAt: string;
  discountAmount: number;
  loyaltyCardId?: string;
  loyaltyCustomerName?: string;
  loyaltyCashback?: number;
}

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer';

export interface CashPayment {
  tendered: number;
  change: number;
  billsCoins: Record<string, number>;
}

export interface PaymentState {
  method: PaymentMethod;
  cash: CashPayment;
  cardProcessing: boolean;
  cardResult?: { success: boolean; message: string };
}

export interface ReceiptLine {
  type: 'header' | 'item' | 'discount' | 'total' | 'payment' | 'footer' | 'barcode';
  text: string;
  value?: string;
}

export interface CurrencyConfig {
  symbol: string;
  code: string;
  notes: number[];
  coins: number[];
}

export interface LoyaltyCard {
  card_id: string;
  store_id: string;
  card_number: string;
  customer_name: string;
  phone?: string;
  email?: string;
  cashback_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface SaleCreatePayload {
  store_id: string;
  staff_user_id: string;
  items: { plu_id?: string; plu_name: string; quantity: number; unit_price: number; total_price: number }[];
  payment_method: PaymentMethod;
  total_amount: number;
  discount_amount?: number;
  payment_note?: string;
  loyalty_card_id?: string;
}

export interface SaleResponse {
  transaction_id: string;
  total_amount: number;
  payment_method: PaymentMethod;
  discount_amount: number;
  change?: number;
  items: { name: string; quantity: number; unit_price: number; total_price: number }[];
  created_at: string;
}
