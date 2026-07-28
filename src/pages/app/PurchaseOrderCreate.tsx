import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import type { ItemSizing } from '../../types';

interface ManualItem {
  plu_id: string;
  plu_label: string;
  quantity_ordered: number;
  cost_price_at_order: number;
  sizing_id: string;
  unit_type: string;
  units_per_pack: number;
  packs_per_case: number;
}

function costPerUnit(item: ManualItem): number {
  const divisor = item.units_per_pack * item.packs_per_case;
  return divisor > 0 ? item.cost_price_at_order / divisor : 0;
}

export default function PurchaseOrderCreate() {
  const navigate = useNavigate();
  const {
    stores, fetchStores, suppliers, fetchSuppliers,
    plusItems, fetchPlus, savePoDraft,
    itemSizing, fetchItemSizing,
    supplierProducts, fetchSupplierProducts,
  } = useAppStore();
  const profile = useAuthStore((s) => s.profile);

  const [manualStoreId, setManualStoreId] = useState('');
  const [manualSupplierId, setManualSupplierId] = useState('');
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  useEffect(() => {
    fetchStores();
    fetchSuppliers();
    fetchPlus();
    fetchItemSizing();
  }, [fetchStores, fetchSuppliers, fetchPlus, fetchItemSizing]);

  useEffect(() => {
    if (manualSupplierId) fetchSupplierProducts(manualSupplierId);
  }, [manualSupplierId, fetchSupplierProducts]);

  const addManualItem = () => {
    setManualItems((prev) => [...prev, {
      plu_id: '', plu_label: '', quantity_ordered: 1, cost_price_at_order: 0,
      sizing_id: '', unit_type: '', units_per_pack: 1, packs_per_case: 1,
    }]);
  };

  const removeManualItem = (idx: number) => {
    setManualItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateManualItem = (idx: number, field: keyof ManualItem, value: any) => {
    setManualItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };

      if (field === 'plu_id') {
        const plu = plusItems.find((p) => p.plu_id === value);
        item.plu_label = plu ? `${plu.plu_number} — ${plu.name}` : '';

        const sp = supplierProducts.find((sp) => sp.plu_id === value);
        if (sp) {
          item.cost_price_at_order = sp.cost_price;
          item.sizing_id = '';
          item.unit_type = '';
          item.units_per_pack = 1;
          item.packs_per_case = 1;
        }
      }

      if (field === 'sizing_id') {
        const sizing = itemSizing.find((s: ItemSizing) => s.id === value);
        if (sizing) {
          item.unit_type = sizing.unit_type;
          item.units_per_pack = Number(sizing.units_per_pack);
          item.packs_per_case = Number(sizing.packs_per_case);
        } else {
          item.unit_type = '';
          item.units_per_pack = 1;
          item.packs_per_case = 1;
        }
      }

      next[idx] = item;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!manualStoreId || !manualSupplierId) return;
    const items = manualItems.filter((i) => i.plu_id && i.quantity_ordered > 0);
    if (items.length === 0) return;
    setManualSubmitting(true);
    const result = await savePoDraft({
      supplier_id: manualSupplierId,
      store_id: manualStoreId,
      items: items.map((i) => ({
        plu_id: i.plu_id,
        quantity_ordered: i.quantity_ordered,
        cost_price_at_order: i.cost_price_at_order,
      })),
      created_by: profile?.user_id,
    });
    setManualSubmitting(false);
    if (!result.error) {
      navigate('/app/inventory/purchase-orders');
    }
  };

  const grandTotal = manualItems.reduce((sum, i) => sum + i.quantity_ordered * i.cost_price_at_order, 0);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Create Manual Purchase Order</h1>
          <p style={{ color: 'var(--text-muted)' }}>Build a purchase order from scratch with packing and cost breakdown.</p>
        </div>
      </div>

      {/* Store & Supplier Selection */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '28px', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '260px' }}>
          <label className="form-label">Store *</label>
          <select className="form-input" value={manualStoreId} onChange={(e) => setManualStoreId(e.target.value)}>
            <option value="">— Select Store —</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '260px' }}>
          <label className="form-label">Supplier *</label>
          <select className="form-input" value={manualSupplierId} onChange={(e) => setManualSupplierId(e.target.value)}>
            <option value="">— Select Supplier —</option>
            {suppliers.map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Line Items */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.5fr 80px 120px 110px 110px 40px',
          gap: '12px', padding: '12px 16px',
          borderBottom: '1px solid var(--border-light)',
          fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}>
          <span>PLU</span>
          <span>Packing</span>
          <span style={{ textAlign: 'center' }}>Qty</span>
          <span style={{ textAlign: 'center' }}>Cost (£)</span>
          <span style={{ textAlign: 'center' }}>Cost / Unit</span>
          <span style={{ textAlign: 'center' }}>Line Total</span>
          <span></span>
        </div>

        {manualItems.length === 0 && (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No items yet. Use the button below to start building your order.
          </div>
        )}

        {manualItems.map((item, idx) => {
          const cpu = costPerUnit(item);
          const lt = item.quantity_ordered * item.cost_price_at_order;
          return (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '2fr 1.5fr 80px 120px 110px 110px 40px',
              gap: '12px', padding: '10px 16px', alignItems: 'flex-end',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
            }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
                <select className="form-input" value={item.plu_id}
                  onChange={(e) => updateManualItem(idx, 'plu_id', e.target.value)}>
                  <option value="">— Select —</option>
                  {plusItems.map((p) => (
                    <option key={p.plu_id} value={p.plu_id}>{p.plu_number} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
                <select className="form-input" value={item.sizing_id}
                  onChange={(e) => updateManualItem(idx, 'sizing_id', e.target.value)}>
                  <option value="">— No sizing —</option>
                  {itemSizing.map((s: ItemSizing) => (
                    <option key={s.id} value={s.id}>
                      {s.unit_type === 'each' ? 'Each' : 'Kg'} · {s.units_per_pack} per pack · {s.packs_per_case} per case
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
                <input type="number" min="1" className="form-input" style={{ textAlign: 'center' }}
                  value={item.quantity_ordered}
                  onChange={(e) => updateManualItem(idx, 'quantity_ordered', parseInt(e.target.value, 10) || 0)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
                <input type="number" step="0.01" min="0" className="form-input" style={{ textAlign: 'center' }}
                  value={item.cost_price_at_order}
                  onChange={(e) => updateManualItem(idx, 'cost_price_at_order', parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ paddingBottom: '1px', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                £{cpu.toFixed(4)}
              </div>
              <div style={{ paddingBottom: '1px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
                £{lt.toFixed(2)}
              </div>
              <button className="btn btn-danger btn-sm" style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                onClick={() => removeManualItem(idx)}>✕</button>
            </div>
          );
        })}

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)' }}>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={addManualItem}>+ Add Item</button>
        </div>
      </div>

      {/* Summary & Submit */}
      <div style={{
        marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px', borderRadius: 'var(--radius-lg)',
        background: 'rgba(8,143,143,0.08)', border: '1px solid rgba(8,143,143,0.2)',
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>Grand Total: </span>
          <span style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
            £{grandTotal.toFixed(2)}
          </span>
          <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '0.85rem' }}>
            {manualItems.filter((i) => i.plu_id).length} item(s)
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/app/inventory/purchase-orders')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}
            disabled={manualSubmitting || !manualStoreId || !manualSupplierId || manualItems.every((i) => !i.plu_id || i.quantity_ordered <= 0)}>
            {manualSubmitting ? 'Creating…' : 'Create PO Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
