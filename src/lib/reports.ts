// src/lib/reports.ts — Shared report definitions (single source of truth)
export interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
}

export const REPORTS: Report[] = [
  {
    id: 'sales-summary',
    title: 'Sales Summary',
    description: 'Total revenue, transactions, average ticket, discounts, refunds, voids grouped by day/week/month',
    category: 'Sales'
  },
  {
    id: 'sales-by-plu',
    title: 'Sales by PLU',
    description: 'Quantity, revenue, discount % per PLU; top/bottom performers',
    category: 'Sales'
  },
  {
    id: 'loyalty',
    title: 'Loyalty Performance',
    description: 'Cards issued, active cards, cashback earned/used/redeemed, discount totals',
    category: 'Loyalty'
  },
  {
    id: 'purchase-orders',
    title: 'Purchase Orders',
    description: 'PO status, quantities ordered vs received, supplier performance (on-time %)',
    category: 'Purchasing'
  },
  {
    id: 'timesheets',
    title: 'Timesheets (Clock In/Out)',
    description: 'Clock-in/out times, hours worked, overtime, missing punches, late/early flags',
    category: 'Staff'
  },
  {
    id: 'stock',
    title: 'Stock / Inventory',
    description: 'Current stock, threshold, value, low-stock flag, stock movement (in/out)',
    category: 'Inventory'
  },
  {
    id: 'cogs',
    title: 'COGS Report',
    description: 'COGS per PLU, gross margin, margin % (FIFO)',
    category: 'Financial'
  },
  {
    id: 'goods-in',
    title: 'Goods In (Receiving)',
    description: 'Received quantities, received date, receiver, PO status, discrepancies',
    category: 'Inventory'
  },
  {
    id: 'plu-list',
    title: 'PLU Master List',
    description: 'PLU ID, name, category, EAN, uses_scale, head-office price, per-store prices, active flag',
    category: 'Lists'
  },
  {
    id: 'users-stores',
    title: 'Users & Stores List',
    description: 'Users: name, role, PIN status, assigned store, active; Stores: name, address, active',
    category: 'Lists'
  },
];

export const REPORT_CATEGORIES = Array.from(new Set(REPORTS.map((r) => r.category))).sort();

export function getReportById(id: string): Report | undefined {
  return REPORTS.find((r) => r.id === id);
}