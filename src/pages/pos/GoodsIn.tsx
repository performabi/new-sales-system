import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import PinPrompt from '../../components/Pos/PinPrompt';

export default function GoodsIn() {
  const { pendingPOs, pendingPOsLoading, fetchPendingPOs, receiveDelivery } = useAppStore();

  const storeId = sessionStorage.getItem('pos_store_id');
  const storeName = sessionStorage.getItem('pos_store_name') || 'Store';

  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [receivedQty, setReceivedQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    if (storeId) {
      fetchPendingPOs(storeId);
    }
  }, [storeId, fetchPendingPOs]);

  const openPO = pendingPOs.find((po: any) => po.po_id === selectedPO) as any;
  const openItems = (openPO?.purchase_order_items || []) as any[];

  const handleSelectPO = (poId: string) => {
    setSelectedPO(poId);
    setReceivedQty({});
  };

  const handleQtyChange = (pluId: string, max: number, val: string) => {
    const parsed = Math.min(max, Math.max(0, parseInt(val) || 0));
    setReceivedQty((prev) => ({ ...prev, [pluId]: parsed }));
  };

  const handleConfirmReceive = async () => {
    if (!selectedPO) return;
    if (!pin) {
      setShowPin(true);
      return;
    }
    const items = Object.entries(receivedQty)
      .filter(([, qty]) => qty > 0)
      .map(([plu_id, qty_received]) => ({ plu_id, qty_received }));
    if (items.length === 0) return;
    setSubmitting(true);
    const { error } = await receiveDelivery(selectedPO, items, pin);
    setSubmitting(false);
    if (error) return;
    setSelectedPO(null);
    setReceivedQty({});
    fetchPendingPOs(storeId!);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>Goods In</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Receive deliveries for {storeName}</p>
      </div>

      {pendingPOsLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : pendingPOs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No pending deliveries.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedPO ? '1fr 1.5fr' : '1fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4>Pending Purchase Orders</h4>
            {pendingPOs.map((po: any) => (
              <div
                key={po.po_id}
                className="card"
                style={{
                  padding: '14px 18px',
                  cursor: 'pointer',
                  borderColor: selectedPO === po.po_id ? 'var(--primary)' : 'var(--border-light)',
                }}
                onClick={() => handleSelectPO(po.po_id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{po.po_number || po.po_id.slice(0, 8)}</strong>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {po.suppliers?.name || 'Unknown Supplier'} · {(po.purchase_order_items || []).length} items
                    </div>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {new Date(po.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedPO && openPO && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>{openPO.po_number || 'Purchase Order'}</h4>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{openPO.suppliers?.name}</span>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>PLU #</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Now</th>
                  </tr>
                </thead>
                <tbody>
                  {openItems.map((item: any) => (
                    <tr key={item.plu_id}>
                      <td>{item.plu?.name || 'Item'}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.plu?.plu_number || '—'}</td>
                      <td>{item.quantity_ordered}</td>
                      <td>{item.quantity_received || 0}</td>
                      <td>
                        <input
                          className="form-input"
                          type="number"
                          min={0}
                          max={item.quantity_ordered - (item.quantity_received || 0)}
                          style={{ width: '70px', padding: '4px 8px' }}
                          value={receivedQty[item.plu_id] ?? ''}
                          onChange={(e) => handleQtyChange(item.plu_id, item.quantity_ordered - (item.quantity_received || 0), e.target.value)}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                className="btn btn-primary"
                style={{ marginTop: '16px', width: '100%' }}
                onClick={handleConfirmReceive}
                disabled={submitting || Object.values(receivedQty).every((q) => !q || q === 0)}
              >
                {submitting ? 'Processing…' : 'Confirm Receive'}
              </button>
            </div>
          )}
        </div>
      )}

      <PinPrompt
        isOpen={showPin}
        onClose={() => setShowPin(false)}
        onSuccess={(_u, enteredPin) => { setPin(enteredPin); setShowPin(false); }}
        title="Enter staff PIN to confirm receipt"
      />
    </div>
  );
}
