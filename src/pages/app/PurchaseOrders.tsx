// src/pages/PurchaseOrders.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import DataTable from '../../components/UI/DataTable';
import { formatCurrency } from '../../lib/formatCurrency';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const {
    purchaseOrders, purchaseOrdersLoading, fetchPurchaseOrders,
    lockPurchaseOrder, fetchSuppliers, suppliers,
    stores, fetchStores, users, fetchUsers,
    poSuggestions, poSuggestionsLoading, fetchPoSuggestions, clearSuggestions,
    savePoDraft,
  } = useAppStore();
  const profile = useAuthStore((s) => s.profile);

  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [editingQty, setEditingQty] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [storeFilter, setStoreFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  useEffect(() => {
    fetchPurchaseOrders();
    fetchSuppliers();
    fetchStores();
    fetchUsers();
  }, [fetchPurchaseOrders, fetchSuppliers, fetchStores, fetchUsers]);

  useEffect(() => {
    // Reset editing quantities when suggestions change
    const qtyMap: Record<string, number> = {};
    for (const sug of poSuggestions) {
      for (const item of sug.items) {
        qtyMap[item.plu_id] = item.suggested_qty;
      }
    }
    setEditingQty(qtyMap);
  }, [poSuggestions]);

  const handleGenerate = () => {
    if (!selectedStoreId) return;
    clearSuggestions();
    fetchPoSuggestions(selectedStoreId);
  };

  const handleCreateDrafts = async () => {
    if (!selectedStoreId) return;
    setCreating(true);
    let hasError = false;
    for (const sug of poSuggestions) {
      const items = sug.items
        .filter((item) => (editingQty[item.plu_id] ?? 0) > 0)
        .map((item) => ({
          plu_id: item.plu_id,
          quantity_ordered: editingQty[item.plu_id] ?? item.suggested_qty,
          cost_price_at_order: 0, // will use the supplier_product cost_price
        }));
      if (items.length === 0) continue;
      const result = await savePoDraft({
        supplier_id: sug.supplier_id,
        store_id: selectedStoreId,
        items,
        created_by: profile?.user_id,
      });
      if (result.error) {
        hasError = true;
        break;
      }
    }
    setCreating(false);
    if (!hasError) {
      clearSuggestions();
      setSelectedStoreId('');
    }
  };

  const handlePrint = (po: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const supplier = suppliers.find((s) => s.supplier_id === po.supplier_id);
    const bankDetails = supplier?.bank_details;

    const itemsRows = (po.purchase_order_items || []).map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.plu?.plu_number || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.plu?.name || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity_ordered}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(item.cost_price_at_order)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(Number(item.cost_price_at_order) * item.quantity_ordered)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order ${po.po_number}</title>
          <style>
            body { font-family: sans-serif; color: #333; padding: 20px; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; padding: 8px; border-bottom: 2px solid #ddd; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #333; padding-bottom: 10px;">
            <div>
              <h1 style="margin: 0; font-size: 28px;">PURCHASE ORDER</h1>
              <p style="margin: 4px 0 0 0; color: #666;">Sales System Head Office</p>
            </div>
            <div style="text-align: right;">
              <h3 style="margin: 0;">Order No: ${po.po_number}</h3>
              <p style="margin: 4px 0 0 0;">Date: ${new Date(po.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
            <div>
              <strong>Vendor:</strong>
              <p style="margin: 4px 0;">
                ${supplier?.name || 'Unknown Supplier'}<br>
                ${supplier?.address || ''}<br>
                Email: ${supplier?.contact_email || ''}<br>
                Phone: ${supplier?.phone || ''}
              </p>
              ${supplier?.vat_number ? `<p style="margin: 4px 0;">VAT Reg: ${supplier.vat_number}</p>` : ''}
              ${supplier?.company_reg_number ? `<p style="margin: 4px 0;">Company Reg: ${supplier.company_reg_number}</p>` : ''}
            </div>
            <div>
              <strong>Deliver To:</strong>
              <p style="margin: 4px 0;">
                Head Office Warehouse / Assigned Store<br>
                Store Location ID: ${po.store_id}
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Cost</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <div style="margin-top: 20px; display: flex; justify-content: space-between;">
            <div>
              ${bankDetails?.bank_name ? `
                <div style="font-size: 12px; color: #666; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
                  <strong>Remittance Details:</strong><br>
                  Bank: ${bankDetails.bank_name}<br>
                  Sort Code: ${bankDetails.sort_code || ''}<br>
                  Account Number: ${bankDetails.account_number || ''}
                </div>
              ` : ''}
            </div>
            <div style="text-align: right; width: 250px;">
              <div style="font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 8px;">
                TOTAL: ${formatCurrency(po.total_cost)}
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleLock = async (poId: string) => {
    if (confirm('Finalize and lock this PO? This will finalize the items list and move status to Ordered.')) {
      await lockPurchaseOrder(poId);
    }
  };

  const columns = [
    { key: 'po_number', label: 'PO Number' },
    { key: 'store_name_po', label: 'Store' },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'created_date', label: 'Creation Date' },
    { key: 'created_by_name', label: 'Created By' },
    { key: 'items_total', label: 'Items' },
    { key: 'items_lines', label: 'Lines' },
    { key: 'status', label: 'Status' },
    { key: 'received_date', label: 'Goods-In Date' },
    { key: 'received_by_name', label: 'Goods-In User' },
    { key: 'total_cost', label: 'Total Cost' },
    { key: 'actions', label: 'Actions' },
  ];

  const userName = (id: string | null | undefined) => users.find((u) => u.user_id === id)?.full_name ?? '—';

  const filteredPo = purchaseOrders.filter((po) => {
    if (storeFilter && po.store_id !== storeFilter) return false;
    const createdAt = new Date(po.created_at).getTime();
    if (dateFrom && createdAt < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
    if (dateTo && createdAt > new Date(`${dateTo}T23:59:59`).getTime()) return false;
    if (supplierFilter.trim() && !(po.suppliers?.name ?? '').toLowerCase().includes(supplierFilter.trim().toLowerCase())) return false;
    return true;
  });

  const tableData = filteredPo.map((po) => {
    const items = po.purchase_order_items ?? [];
    const itemsTotal = items.reduce((sum, i) => sum + Number(i.quantity_ordered || 0), 0);
    return {
      ...po,
      store_name_po: po.stores?.name || '—',
      supplier_name: po.suppliers?.name || 'Unknown',
      created_date: new Date(po.created_at).toLocaleDateString(),
      created_by_name: userName(po.created_by),
      items_total: itemsTotal,
      items_lines: items.length,
      received_date: po.received_at ? new Date(po.received_at).toLocaleDateString() : '—',
      received_by_name: userName(po.received_by),
      status: <span className={`badge badge-${po.status === 'draft' ? 'warning' : 'success'}`}>{po.status.toUpperCase()}</span>,
      total_cost: formatCurrency(po.total_cost),
      actions: (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(po)}>🖨️ PDF / Print</button>
          {po.status === 'draft' && (
            <button className="btn btn-primary btn-sm" onClick={() => handleLock(po.po_id)}>🔒 Finalize & Lock</button>
          )}
        </div>
      ),
    };
  });

  const totalSuggestedCost = poSuggestions.reduce((sum, s) => sum + s.total_suggested_cost, 0);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Purchase Orders</h1>
          <p style={{ color: 'var(--text-muted)' }}>Confirm pending cumulative drafts and download formatted PO PDFs.</p>
        </div>
      </div>

      {/* Auto-Suggestion Section */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <h3 style={{ marginBottom: '16px' }}>📊 Auto-Suggest Reorder Quantities</h3>
        <div className="filter-bar" style={{ marginBottom: poSuggestions.length === 0 ? 0 : '20px' }}>
          <div className="filter-group" style={{ minWidth: '240px' }}>
            <label className="filter-label">Target Store</label>
            <select
              className="form-select"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              <option value="">— Select Store —</option>
              {stores.map((s) => (
                <option key={s.store_id} value={s.store_id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!selectedStoreId || poSuggestionsLoading}>
            {poSuggestionsLoading ? 'Generating…' : 'Generate Suggestions'}
          </button>
          {poSuggestions.length > 0 && (
            <button className="btn btn-ghost" onClick={clearSuggestions}>Clear</button>
          )}
        </div>

        {poSuggestionsLoading && (
          <div className="loading-spinner"><div className="spinner"></div></div>
        )}

        {poSuggestions.length > 0 && !poSuggestionsLoading && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {poSuggestions.length} supplier{poSuggestions.length > 1 ? 's' : ''} · {poSuggestions.reduce((c, s) => c + s.items.length, 0)} items · Total: {formatCurrency(totalSuggestedCost)}
              </span>
              <button className="btn btn-primary" onClick={handleCreateDrafts} disabled={creating}>
                {creating ? 'Creating Drafts…' : `Create Draft PO${poSuggestions.length > 1 ? 's' : ''}`}
              </button>
            </div>

            {poSuggestions.map((sug) => (
              <div key={sug.supplier_id} className="card" style={{ marginBottom: '16px', padding: '16px 20px' }}>
                <h4 style={{ marginBottom: '12px', color: 'var(--primary)' }}>{sug.supplier_name}</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PLU</th>
                      <th>Name</th>
                      <th>SKU</th>
                      <th>Avg Daily Sales</th>
                      <th>Avg Receipt (8wk)</th>
                      <th>Lead (d)</th>
                      <th>Suggested Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sug.items.map((item) => (
                      <tr key={item.plu_id}>
                        <td style={{ fontFamily: 'monospace' }}>{item.plu_number}</td>
                        <td>{item.plu_name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.supplier_sku || '—'}</td>
                        <td>{item.avg_daily_sales}</td>
                        <td>{item.avg_receipt_8wk}</td>
                        <td>{item.lead_time_days}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            style={{ width: '80px', padding: '4px 8px', fontSize: '0.85rem' }}
                            value={editingQty[item.plu_id] ?? item.suggested_qty}
                            onChange={(e) => setEditingQty((prev) => ({ ...prev, [item.plu_id]: parseInt(e.target.value, 10) || 0 }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Manual PO Creation */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginBottom: '4px' }}>✍️ Manual Purchase Order</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Create a PO from scratch by selecting items individually.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/app/inventory/purchase-orders/create')}>+ New Manual PO</button>
        </div>
      </div>

      {/* Existing PO List */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-group" style={{ minWidth: '200px' }}>
          <label className="filter-label">Store</label>
          <select className="form-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group" style={{ minWidth: '160px' }}>
          <label className="filter-label">From</label>
          <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="filter-group" style={{ minWidth: '160px' }}>
          <label className="filter-label">To</label>
          <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="filter-group" style={{ minWidth: '220px' }}>
          <label className="filter-label">Supplier (contains)</label>
          <input
            type="text"
            className="form-input"
            placeholder="Type to filter supplier…"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          />
        </div>
        <div style={{ alignSelf: 'flex-end', paddingBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{tableData.length} order{tableData.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {purchaseOrdersLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No purchase orders generated." />
      )}
    </div>
  );
}
