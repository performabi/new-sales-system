# New Sales System — Full Implementation Plan

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    HEAD OFFICE                            │
│  (/headoffice/*)                                         │
│  Brain: authoritative source of truth                    │
│                                                          │
│  Users, Stores, PLUs, Categories, Pricing                │
│  Suppliers, Supplier-Products, Purchase Orders           │
│  Item Sizing, Loyalty Cards (registered)                 │
│  Inventory Control (adjustments, reporting)              │
│  PO Auto-Suggestion Engine                               │
└──────────────────────┬───────────────────────────────────┘
                       │ transactional data flows UP
                       │ lookup data flows DOWN
┌──────────────────────▼───────────────────────────────────┐
│                    STORE TERMINAL / POS                    │
│  (/pos/*)                                                 │
│  Thin client — same codebase, separate layout             │
│                                                          │
│  PIN Login               Scale Integration                │
│  Barcode/QR Scanner      Clock In/Out                     │
│  Day Start/End Checklists                                 │
│  Delivery Note → Inventory ↑                              │
│  Till/POS → Sales → Inventory ↓                           │
│  Loyalty Visit Log (PLUs, qty, value, payment)            │
└──────────────────────────────────────────────────────────┘
```

## Route Structure

```
/                           → Landing page (auth choice)
/headoffice/login           → Email/password login
/headoffice/*               → Admin/Super-User portal
  /headoffice/dashboard
  /headoffice/stores
  /headoffice/plu
  /headoffice/users
  /headoffice/inventory
  /headoffice/inventory/purchase-orders
  /headoffice/setup/categories
  /headoffice/setup/item-sizing
  /headoffice/setup/logbook
  /headoffice/setup/suppliers

/pos/login                  → PIN-only login
/pos/*                      → Store Terminal
  /pos/dashboard
  /pos/deliveries
  /pos/till
```

## Authentication

| User Role      | `/` Landing           | `/headoffice/*`       | `/pos/*`             |
|----------------|-----------------------|----------------------|----------------------|
| Not logged in  | Shows both options    | Redirects to login   | Redirects to login   |
| super_user     | Dashboard + both links| Full access          | Full access          |
| admin          | Dashboard + both links| Full access          | Full access          |
| user           | N/A (auto-redirect)   | Blocked              | Full access (PIN)    |

---

## Phase 0 — Foundation & PO Suggestion

### 0a — Migrations

| Migration | Changes |
|-----------|---------|
| `011_expected_delivery_on_po` | `purchase_orders.expected_delivery_date DATE` |
| `012_sales_transactions` | `sales_transactions`, `sale_items` tables |
| `013_pos_pin` | `users.pin_hash TEXT UNIQUE`, `staff_timesheets` table |

### 0b — Route Restructure

- `/headoffice/*` — all current HO routes prefixed
- `/pos/*` — new POS routes
- `/` — Landing page with auth choice
- Sidebar paths updated, POS link added for admin/super
- TerminalLayout created (fullscreen, no sidebar)

### 0c — PO Auto-Suggestion

**Logic per preferred supplier-product:**
```
daily_sales_velocity = CASE WHEN sales exist THEN sum(qty_sold_last_7d) / 7 ELSE 0 END
avg_receipt_8wk = avg(quantity_received per delivery, last 8 weeks)
suggested_qty = CASE
  WHEN daily_sales_velocity > 0
    THEN max(avg_receipt_8wk, ceil(daily_sales_velocity * lead_time_days))
  ELSE avg_receipt_8wk
END
```

---

## Phase 1 — POS Infrastructure

| File | Purpose |
|------|---------|
| `src/pages/pos/Login.tsx` | PIN-only login |
| `src/pages/pos/Dashboard.tsx` | Clock status, pending deliveries, new sale |
| `src/components/Layout/TerminalLayout.tsx` | Fullscreen, bottom nav |
| `src/hooks/useScanner.ts` | Barcode/QR scanner |
| `src/hooks/useScale.ts` | Scale interface |
| `src/store/posStore.ts` | POS-specific state |

---

## Phase 2 — POS Core Ops

- Clock In/Out
- Day Start/End Checklists
- Delivery Note Confirmation → Inventory ↑

---

## Phase 3 — POS Till (Multi-Basket with PIN)

**Basket flow:**
1. "New Sale" → PIN entry → user attached
2. Scan/weigh items → basket builds
3. Payment (cash/card/bank)
4. Finalize → transaction saved → inventory ↓

---

## Phase 4 — POS Loyalty

- QR scan → lookup customer
- Points accrual/redemption
- Visit logging

---

## Phase 5 — Inventory Control (HO)

- Stock adjustments, transfers, stock takes
- Low stock alerts, reports
- Movement history

---

## Migrations Summary

| #  | Name | Adds |
|----|------|------|
| 011 | `expected_delivery_on_po` | `purchase_orders.expected_delivery_date` |
| 012 | `sales_transactions` | `sales_transactions`, `sale_items` |
| 013 | `pos_pin` | `users.pin_hash` (UNIQUE), `staff_timesheets` |
| 014 | `store_checklists` | `store_checklists`, `checklist_completions` |
| 015 | `loyalty_visits` | `loyalty_visits` |
| 016 | `inventory_movements` | `inventory_movements` |

---

## Principle

No existing functionality is removed or altered. All current HO pages move under `/headoffice/` prefix but remain functionally identical.
