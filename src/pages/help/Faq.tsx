import { useMemo, useState } from 'react';

interface Article {
  q: string;
  a: string;
}

interface Section {
  id: string;
  title: string;
  icon: string;
  articles: Article[];
}

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started & Access',
    icon: '🚀',
    articles: [
      {
        q: 'How do I log in to the POS terminal?',
        a: 'On the terminal screen tap /pos/access (or /pos/select-store) and enter your 4–8 digit PIN on the keypad. If you are a standard staff member with an assigned store, the terminal opens that store straight away. If you are an admin or super-admin, you will be asked to pick a tenant and then a store before the dashboard loads.',
      },
      {
        q: 'My PIN was rejected. What should I do?',
        a: 'Check you are typing the exact PIN set for your user account in Head Office (Setup → Users). PINs are unique per tenant. After too many incorrect attempts the server locks your PIN for 15 minutes to prevent guessing — wait for the lockout to clear before trying again.',
      },
      {
        q: 'How do I change my PIN?',
        a: 'A tenant admin can update a user PIN from Head Office (Setup → Users → edit the user). Platform admins can change their own PIN from /admin/settings. PINs are stored salted and hashed; they are never shown in plain text.',
      },
      {
        q: 'How do I reset a forgotten password?',
        a: 'Use the reset-password link on the login page to reset via email. Tenant admins can also resend invites or reset passwords from Setup → Users, and platform admins from Admin → Tenants → the tenant detail page.',
      },
      {
        q: 'I belong to several businesses. How do I pick which one to open?',
        a: 'After signing in, users with access to multiple tenants are shown the tenant-selection screen. Choose the tenant whose Head Office you want to open; staff with a single assigned store are sent straight to the POS terminal.',
      },
    ],
  },
  {
    id: 'till',
    title: 'The Till (Selling)',
    icon: '🧾',
    articles: [
      {
        q: 'How do I start a new sale?',
        a: 'From the terminal Home screen tap "New Sale", enter your staff PIN to open a basket tab, then scan a barcode or tap a product in the PLU grid. Every staff member can have their own basket tab so several colleagues can serve at once.',
      },
      {
        q: 'How do I weigh a product sold by weight?',
        a: 'Products marked "sold by weight" (uses_scale) open the Weigh Item window instead of being added directly. Connect the scale (see Peripherals), confirm a stable reading, and press Add to Basket. The price is calculated as price per kg × weight, and the weight becomes the line quantity.',
      },
      {
        q: 'How do I apply a barcode scan?',
        a: 'Type or scan a barcode into the scan box at the top of the till. The system looks up the matching product (EAN) and adds it to the active basket. Loyalty card QR codes are handled by the loyalty: prefix flow.',
      },
      {
        q: 'How do discounts work?',
        a: 'A discount can be applied to a basket, but only when a loyalty card is attached to that basket. The discount is taken from the customer\'s cashback balance first, then the till works out any cashback the sale earns.',
      },
      {
        q: 'Which payment methods can I take?',
        a: 'Cash, Card, Contactless and Bank Transfer. For cash you enter the amount tendered and the till shows the change due. The receipt prints cash given and change. Card/contactless currently confirm instantly — Dojo terminal integration is planned.',
      },
      {
        q: 'Why was my sale rejected?',
        a: 'The server validates every sale before recording it. Common reasons: the total or a line price does not match the product\'s current price, a cash payment is short (cash given below the total), the staff PIN does not verify, or the basket is empty. Check the price list and the amount entered, then try again.',
      },
      {
        q: 'How do I print a receipt?',
        a: 'After a sale completes, the receipt window opens. "Print Receipt" sends the receipt to the configured ESC/POS printer when one is connected; otherwise it falls back to the browser\'s 80 mm print window. If a printer is offline the browser fallback is used automatically.',
      },
      {
        q: 'How do I void a sale?',
        a: 'Open Transactions on the terminal, find the sale for the selected day and choose Void. Confirm the action — the system restores the inventory and reverses any loyalty cashback before marking the transaction void.',
      },
    ],
  },
  {
    id: 'stock',
    title: 'Stock & Goods In',
    icon: '📦',
    articles: [
      {
        q: 'How do I create a purchase order?',
        a: 'Go to Head Office → Purchase Orders → Create. Choose the store and supplier, expected delivery date, and line items with unit cost. You can also use "Suggestions" to auto-generate a draft based on the last 7 days of sales and average receipts over 8 weeks.',
      },
      {
        q: 'What does locking a purchase order do?',
        a: 'Locking turns a draft into an "ordered" PO with a PO number (format PO-YYYY-XXXXXX). Ordered POs are the ones the store can receive against on the terminal. A draft is kept per supplier and store, so re-opening continues where you left off.',
      },
      {
        q: 'How do I receive a delivery on the terminal?',
        a: 'Use Goods In on the terminal. It lists pending (ordered) purchase orders for your store. Enter the received quantity per line (capped at the remaining ordered amount), the delivered date, and confirm with your PIN. Inventory stock updates automatically and the PO moves to received or partially received.',
      },
      {
        q: 'How does stock change automatically?',
        a: 'Inventory updates automatically with every sale (quantities deducted), every void (restored), and every goods-in receipt (stock added). Track current levels in Head Office → Inventory, where low stock (≤ 5) is highlighted.',
      },
    ],
  },
  {
    id: 'headoffice',
    title: 'Head Office',
    icon: '🏢',
    articles: [
      {
        q: 'How do I add a new product (PLU)?',
        a: 'Head Office → PLU → Add. Enter the PLU number (must be unique), name, category, VAT class, an optional EAN barcode, a head-office price, and per-store prices if they differ. Toggle "sold by weight" for scale products. Every change is recorded in the Logbook.',
      },
      {
        q: 'How do per-store prices work?',
        a: 'Each PLU has a head-office price plus optional per-store price columns. The till uses the store\'s own price when set, otherwise it falls back to the head-office price. Set them on the PLU edit screen.',
      },
      {
        q: 'How do I create a store or user?',
        a: 'Stores: Head Office → Stores. Users: Head Office → Users, where you can invite staff by email and set their role (admin or user), PIN, and assigned store. Admins have no fixed store and can open any store with their PIN.',
      },
      {
        q: 'How do suppliers and categories fit together?',
        a: 'Categories (Setup → Categories) organise products for the PLU grid and inventory filters. Suppliers (Setup → Suppliers) hold contact and bank details, and each supplier can be linked to products with cost price, lead time and a preferred flag — this feeds the purchase-order suggestions.',
      },
      {
        q: 'What is Item Sizing used for?',
        a: 'Item Sizing defines packing units (each or kg), units per pack and packs per case. These are used to calculate case totals and per-unit costs on purchase orders.',
      },
      {
        q: 'Where do I review sales across all stores?',
        a: 'Head Office → Sales Review lists every transaction across all stores with date, store and payment-method filters. Expand any row to see line items, discount, cash given/change and cashback earned. The Dashboard gives a summary with date-range presets.',
      },
    ],
  },
  {
    id: 'loyalty',
    title: 'Loyalty',
    icon: '💳',
    articles: [
      {
        q: 'How do customers sign up for a loyalty card?',
        a: 'Customers register on the public loyalty registration page (choose their business, then enter name, phone, email and postcode). The system issues a card number and starts them with a zero balance. Cards also appear in Head Office → Loyalty Cards.',
      },
      {
        q: 'How is cashback calculated?',
        a: 'One global cashback percentage (Setup → Cashback, default 5%) applies to all stores. On a sale with a loyalty card attached, the discount used is deducted from the card balance and cashback earned (total × percent) is added. Voiding a sale reverses both.',
      },
      {
        q: 'How do I attach a loyalty card at the till?',
        a: 'From the basket, attach the customer\'s card — scan their card QR or look up the card with your PIN. Only then can you apply a discount to the basket, and the sale earns cashback on their balance.',
      },
      {
        q: 'How do loyalty notifications work?',
        a: 'Create messages in Head Office → Loyalty Notifications, optionally targeting a single store. Sent messages appear on the till\'s notification bar for that store so staff can inform customers.',
      },
    ],
  },
  {
    id: 'devices',
    title: 'Peripherals (Devices)',
    icon: '🖨️',
    articles: [
      {
        q: 'How do I configure the scale?',
        a: 'Head Office → Setup → Devices, pick the store, and enable the Scale. Choose the protocol that matches your scale\'s output (continuous ASCII such as ST,GS,+ 0.000kg, a bare float, or a custom regex) and the baud rate (default 9600). Use the Scale Debug panel to see the raw stream and confirm the parsed weight.',
      },
      {
        q: 'How do I set up the receipt printer?',
        a: 'In Setup → Devices enable the Receipt Printer and choose the transport: Web USB (most ESC/POS printers) or Web Serial (RS-232). Optionally enter the model and the USB vendor/product IDs so the browser can auto-filter the device chooser. Network (TCP 9100) printers need a companion bridge and are not yet supported.',
      },
      {
        q: 'How does the cash drawer open?',
        a: 'The drawer kicks automatically after a successful cash sale. Configure it in Setup → Devices as "chained" (the kick is sent through the receipt printer) or "standalone" (its own serial port). When no real device is configured the system falls back to simulators so the till keeps working.',
      },
      {
        q: 'What happens if no hardware is connected?',
        a: 'If a device is not enabled, not connected, or the browser lacks Web Serial/USB support, the till automatically uses simulator drivers — the scale returns test weights, and printing falls back to the browser window. This keeps the terminal usable during setup and testing.',
      },
    ],
  },
  {
    id: 'clock',
    title: 'Clock & Checklists',
    icon: '⏰',
    articles: [
      {
        q: 'How do I clock in and out?',
        a: 'Open Clock on the terminal; it asks for your PIN, then shows your current status and recent shifts. Clock in records the start time for your store, clock out stamps the end time on the same shift. Times are stored in staff timesheets.',
      },
      {
        q: 'How do store checklists work?',
        a: 'The terminal Checklists screen shows the start-of-day list before noon and the end-of-day list from noon onward. Tasks are defined per store and type in Head Office → Setup → Store Checklists, with a sort order. Staff tick each task to complete the checklist.',
      },
    ],
  },
  {
    id: 'admin',
    title: 'Platform Admin',
    icon: '🛠️',
    articles: [
      {
        q: 'How do I create a new customer/tenant?',
        a: 'Log in as a super-admin, go to Admin → Tenants → Provision New Company. Enter the business name, URL slug and plan, plus the admin email/name. The system creates the tenant schema and emails an invite to the new admin.',
      },
      {
        q: 'What are the subscription plans?',
        a: 'Plans define the maximum stores and users and the trial period for each customer. They are managed in Admin → Plans and assigned when provisioning or editing a tenant.',
      },
      {
        q: 'How do I manage the platform team?',
        a: 'Admin → Team (Super Users) invites staff as super_admin or support. Super-admins can provision tenants and manage plans; support staff get access to the admin area with more limited powers. Each team member sets their own PIN in Admin → Settings.',
      },
    ],
  },
];

export default function Faq() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS
      .map((section) => ({
        ...section,
        articles: section.articles.filter((a) =>
          a.q.toLowerCase().includes(q) ||
          a.a.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.articles.length > 0);
  }, [query]);

  const totalArticles = SECTIONS.reduce((n, s) => n + s.articles.length, 0);
  const shownArticles = filtered.reduce((n, s) => n + s.articles.length, 0);

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>FAQ & Support</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Help articles for the POS terminal and Head Office.
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          className="form-input"
          style={{ maxWidth: 420 }}
          placeholder="Search questions, keywords, sections…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim() && (
          <div style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {shownArticles} of {totalArticles} articles match
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
          <h3>No articles found</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            Try a different search term or clear the search box.
          </p>
        </div>
      ) : (
        filtered.map((section) => (
          <div key={section.id} className="card" style={{ marginBottom: '16px', padding: '20px' }}>
            <h3 style={{ marginBottom: '12px' }}>
              <span style={{ marginRight: '8px' }}>{section.icon}</span>
              {section.title}
            </h3>
            {section.articles.map((article, idx) => (
              <details
                key={idx}
                style={{
                  borderBottom: '1px solid var(--border-medium)',
                  padding: '10px 0',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    listStyle: 'none',
                  }}
                >
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{article.q}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>▾</span>
                  </span>
                </summary>
                <p style={{ color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.6 }}>
                  {article.a}
                </p>
              </details>
            ))}
          </div>
        ))
      )}

      <div className="card" style={{ textAlign: 'center', padding: '32px', marginTop: '8px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📧</div>
        <h3>Still need help?</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '16px' }}>
          Contact our support team
        </p>
        <a
          href="mailto:info@performabi.com"
          className="btn btn-primary"
          style={{ display: 'inline-block', padding: '12px 32px', textDecoration: 'none' }}
        >
          Email Support
        </a>
      </div>
    </div>
  );
}