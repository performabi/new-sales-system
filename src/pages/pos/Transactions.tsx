import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

export default function PosTransactions() {
  const storeId = sessionStorage.getItem('pos_store_id');
  const storeName = sessionStorage.getItem('pos_store_name') || 'Store';
  const { saleTransactions, saleTransactionsLoading, fetchSaleTransactions, voidSale } = useAppStore();

  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [voiding, setVoiding] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (storeId) {
      fetchSaleTransactions(storeId, dateFilter);
    }
  }, [storeId, dateFilter]);

  const handleVoid = async (txId: string) => {
    if (!window.confirm('Void this transaction? This will restore inventory and loyalty cashback.')) return;
    setVoiding(true);
    const result = await voidSale(txId);
    setVoiding(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    if (storeId) fetchSaleTransactions(storeId, dateFilter);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>Transactions</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{storeName}</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
        />
        <button className="btn btn-ghost" onClick={() => fetchSaleTransactions(storeId!, dateFilter)} disabled={saleTransactionsLoading}>
          Refresh
        </button>
      </div>

      {saleTransactionsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : saleTransactions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          No transactions for this date
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Items</th>
                <th>Total</th>
                <th>Discount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {saleTransactions.map((tx: any) => {
                const itemCount = tx.sale_items?.length ?? 0;
                return (
                  <tr key={tx.transaction_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTx(selectedTx?.transaction_id === tx.transaction_id ? null : tx)}>
                    <td>{new Date(tx.created_at).toLocaleTimeString('en-GB')}</td>
                    <td>{itemCount} item{itemCount !== 1 ? 's' : ''}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>£{Number(tx.total_amount).toFixed(2)}</td>
                    <td>{tx.discount_amount > 0 ? `-£${Number(tx.discount_amount).toFixed(2)}` : '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{tx.payment_method}</td>
                    <td>
                      <span className={`badge ${tx.status === 'void' ? 'badge-danger' : 'badge-success'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td>
                      {tx.status !== 'void' && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.75rem', padding: '4px 10px', color: 'var(--error)' }}
                          onClick={(e) => { e.stopPropagation(); handleVoid(tx.transaction_id); }}
                          disabled={voiding}
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedTx && (
        <div className="card" style={{ marginTop: '16px', padding: '16px' }}>
          <h4 style={{ marginBottom: '12px' }}>
            Transaction Items · {new Date(selectedTx.created_at).toLocaleString('en-GB')}
          </h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(selectedTx.sale_items || []).map((item: any, i: number) => (
                <tr key={i}>
                  <td>{item.plu_name}</td>
                  <td>{item.quantity}</td>
                  <td>£{Number(item.unit_price).toFixed(2)}</td>
                  <td>£{Number(item.total_price || item.unit_price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedTx.payment_note && (
            <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Note: {selectedTx.payment_note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
