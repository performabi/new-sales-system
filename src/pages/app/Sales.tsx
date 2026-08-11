// src/pages/app/Sales.tsx — head-office sales review (view only)
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { apiFetch } from '../../lib/api';
import { formatCurrency } from '../../lib/formatCurrency';

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'contactless', 'transfer'];

function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function Sales() {
  const profile = useAuthStore((s) => s.profile);
  const { stores, fetchStores } = useAppStore();

  const [startDate, setStartDate] = useState(dateNDaysAgo(6));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [storeId, setStoreId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (stores.length === 0) fetchStores();
  }, [stores.length, fetchStores]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let url = `/api/sales?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
      if (storeId) url += `&store_id=${encodeURIComponent(storeId)}`;
      if (paymentMethod) url += `&payment_method=${encodeURIComponent(paymentMethod)}`;
      try {
        const res = await apiFetch(url);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTransactions(data ?? []);
        }
      } catch (err) {
        console.error('fetchSales error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startDate, endDate, storeId, paymentMethod, refreshKey]);

  const setPreset = (days: number) => {
    setStartDate(dateNDaysAgo(days));
    setEndDate(new Date().toISOString().slice(0, 10));
  };

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.store_id, s.name])), [stores]);

  const summary = useMemo(() => {
    let count = 0;
    let total = 0;
    let discounts = 0;
    for (const tx of transactions) {
      if (tx.status === 'void') continue;
      count += 1;
      total += Number(tx.total_amount) || 0;
      discounts += Number(tx.discount_amount) || 0;
    }
    return { count, total, discounts };
  }, [transactions]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Sales Review</h1>
          <p>View-only sales overview for {profile?.full_name}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="filter-bar" style={{ flexWrap: 'wrap', rowGap: '12px' }}>
          <div className="filter-group">
            <label className="filter-label">From</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">To</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', paddingBottom: '2px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreset(0)}>Today</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreset(6)}>7 days</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreset(29)}>30 days</button>
          </div>
          <div className="filter-group">
            <label className="filter-label">Store</label>
            <select className="form-select" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">All Stores</option>
              {stores.map((s) => (
                <option key={s.store_id} value={s.store_id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Payment</label>
            <select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--primary)' }}>
            {loading ? '…' : summary.count}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Sales</div>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--accent)' }}>
            {loading ? '…' : formatCurrency(summary.total)}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Total Sold</div>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#ffbd59' }}>
            {loading ? '…' : formatCurrency(summary.discounts)}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Discounts</div>
        </div>
      </div>

      {/* Transactions */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : transactions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No sales found for the selected filters.
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Store</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => (
                <Fragment key={tx.transaction_id}>
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === tx.transaction_id ? null : tx.transaction_id)}
                  >
                    <td>{new Date(tx.created_at).toLocaleString('en-GB')}</td>
                    <td>{storeMap.get(tx.store_id) || '—'}</td>
                    <td>{(tx.sale_items || []).length}</td>
                    <td style={{ textTransform: 'capitalize' }}>{tx.payment_method}</td>
                    <td>
                      <span className={`badge ${tx.status === 'void' ? 'badge-danger' : 'badge-success'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                      {formatCurrency(tx.total_amount)}
                    </td>
                  </tr>
                  {expandedId === tx.transaction_id && (
                    <tr>
                      <td colSpan={6} style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th style={{ textAlign: 'right' }}>Qty</th>
                              <th style={{ textAlign: 'right' }}>Unit Price</th>
                              <th style={{ textAlign: 'right' }}>Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(tx.sale_items || []).map((item: any, i: number) => (
                              <tr key={i}>
                                <td>{item.plu_name}</td>
                                <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {formatCurrency(item.total_price || item.unit_price * item.quantity)}
                                </td>
                              </tr>
                            ))}
                            {tx.discount_amount > 0 && (
                              <tr>
                                <td colSpan={3} style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                  Discount{tx.loyalty_card_id ? ' (loyalty)' : ''}
                                </td>
                                <td style={{ textAlign: 'right' }}>-{formatCurrency(tx.discount_amount)}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        {tx.payment_note && (
                          <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Note: {tx.payment_note}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
