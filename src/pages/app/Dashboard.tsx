// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { apiFetch } from '../../lib/api';
import { formatCurrency } from '../../lib/formatCurrency';
import StatsCard from '../../components/UI/StatsCard';

type RangePreset = 'today' | '7d' | '15d' | '30d' | 'custom';

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { stores, users, inventory, logEntries, fetchStores, fetchUsers, fetchInventory, fetchLogbook } = useAppStore();

  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customStart, setCustomStart] = useState(dateString(new Date(Date.now() - 6 * 86400000)));
  const [customEnd, setCustomEnd] = useState(dateString(new Date()));
  const [sales, setSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  useEffect(() => {
    fetchStores();
    fetchUsers();
    fetchInventory();
    fetchLogbook();
  }, [fetchStores, fetchUsers, fetchInventory, fetchLogbook]);

  const range = useMemo(() => {
    const end = new Date();
    if (preset === 'today') return { start: dateString(end), end: dateString(end) };
    if (preset === '15d') return { start: dateString(new Date(Date.now() - 14 * 86400000)), end: dateString(end) };
    if (preset === '30d') return { start: dateString(new Date(Date.now() - 29 * 86400000)), end: dateString(end) };
    if (preset === 'custom') return { start: customStart || dateString(end), end: customEnd || dateString(end) };
    return { start: dateString(new Date(Date.now() - 6 * 86400000)), end: dateString(end) };
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    let cancelled = false;
    setSalesLoading(true);
    (async () => {
      try {
        const res = await apiFetch(`/api/sales?start_date=${encodeURIComponent(range.start)}&end_date=${encodeURIComponent(range.end)}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSales(data ?? []);
        }
      } catch (err) {
        console.error('Dashboard sales fetch error:', err);
      } finally {
        if (!cancelled) setSalesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range.start, range.end]);

  const salesSummary = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const tx of sales) {
      if (tx.status === 'void') continue;
      count += 1;
      total += Number(tx.total_amount) || 0;
    }
    return { count, total };
  }, [sales]);

  const paymentSplit = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    let totalTx = 0;
    let totalRev = 0;
    for (const tx of sales) {
      if (tx.status === 'void') continue;
      const raw = String(tx.payment_method || 'cash');
      const method = raw === 'bank_transfer' ? 'transfer' : raw;
      const ent = map.get(method) || { count: 0, revenue: 0 };
      ent.count++;
      ent.revenue += Number(tx.total_amount) || 0;
      map.set(method, ent);
      totalTx++;
      totalRev += Number(tx.total_amount) || 0;
    }
    return { map, totalTx, totalRev };
  }, [sales]);

  const rangeLabel =
    preset === 'today' ? 'Today'
      : preset === '7d' ? 'Last 7 days'
      : preset === '15d' ? 'Last 15 days'
      : preset === '30d' ? 'Last 30 days'
      : 'Custom range';

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p>Welcome back, {profile?.full_name}</p>
        </div>
      </div>

      {/* Sales range filter */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div className="filter-bar" style={{ flexWrap: 'wrap', rowGap: '12px' }}>
          <div className="filter-group" style={{ marginBottom: 0 }}>
            <label className="filter-label">Sales Period</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className={`btn btn-sm ${preset === 'today' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPreset('today')}>Today</button>
              <button className={`btn btn-sm ${preset === '7d' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPreset('7d')}>7 Days</button>
              <button className={`btn btn-sm ${preset === '15d' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPreset('15d')}>15 Days</button>
              <button className={`btn btn-sm ${preset === '30d' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPreset('30d')}>30 Days</button>
              <button className={`btn btn-sm ${preset === 'custom' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPreset('custom')}>Custom</button>
            </div>
          </div>
          {preset === 'custom' && (
            <>
              <div className="filter-group" style={{ marginBottom: 0 }}>
                <label className="filter-label">From</label>
                <input type="date" className="form-input" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="filter-group" style={{ marginBottom: 0 }}>
                <label className="filter-label">To</label>
                <input type="date" className="form-input" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
          <span style={{ alignSelf: 'flex-end', paddingBottom: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {rangeLabel}
          </span>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard
          title="Total Stores"
          value={stores.length}
          icon="🏪"
          variant="primary"
        />
        <StatsCard
          title="Total Users"
          value={users.length}
          icon="👥"
          variant="secondary"
        />
        <StatsCard
          title="Inventory Items"
          value={inventory.length}
          icon="📦"
          variant="info"
        />
        <StatsCard
          title="System Status"
          value="Online"
          icon="✅"
          variant="success"
        />
        <StatsCard
          title={`Sales (${rangeLabel})`}
          value={salesLoading ? '…' : salesSummary.count}
          icon="🧾"
          variant="secondary"
        />
        <StatsCard
          title={`Total Sold (${rangeLabel})`}
          value={salesLoading ? '…' : formatCurrency(salesSummary.total)}
          icon="💷"
          variant="primary"
        />
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Payment Split ({rangeLabel})</h3>
        {paymentSplit.totalTx === 0 ? (
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>No transactions in this period</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '12px' }}>
            {Array.from(paymentSplit.map.entries()).map(([method, vals]) => {
              const pct = paymentSplit.totalTx ? ((vals.count / paymentSplit.totalTx) * 100).toFixed(1) : '0';
              const revPct = paymentSplit.totalRev ? ((vals.revenue / paymentSplit.totalRev) * 100).toFixed(1) : '0';
              return (
                <div key={method} style={{ padding: '12px', border: '1px solid var(--border-light)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{method}</div>
                  <div style={{ fontWeight: 700, marginTop: '4px' }}>{vals.count} tx • {pct}%</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatCurrency(vals.revenue)} • {revPct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Recent System Activity</h3>
        <div style={{ marginTop: '16px' }}>
          {logEntries.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px' }}>
              <p>Activity feed will appear here as users interact with the system.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {logEntries.slice(0, 5).map((log, i) => (
                <li key={`${log.id}-${i}`} style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, marginRight: '8px' }}>[{log.entity}]</span>
                    <span style={{ color: 'var(--text-medium)' }}>{log.entityLabel}</span>
                    <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>•</span>
                    <span>{log.action === 'delete' ? log.newValue : log.action === 'create' ? `Created ${log.field}: ${log.newValue}` : `Changed ${log.field} from "${log.oldValue}" to "${log.newValue}"`}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    by {log.username} at {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
