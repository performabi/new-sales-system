// src/pages/app/Reporting.tsx — Reports suite with hero filters and report list
import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { apiFetch } from '../../lib/api';

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
}

const REPORTS: Report[] = [
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
    description: 'COGS per PLU, gross margin, margin %',
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

function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function Reporting() {
  const { stores, fetchStores } = useAppStore();

  const [startDate, setStartDate] = useState(dateNDaysAgo(30));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [storeId, setStoreId] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportColumns, setReportColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'html' | 'csv' | 'pdf'>('html');

  useEffect(() => {
    if (stores.length === 0) fetchStores();
  }, [stores.length, fetchStores]);

  const runReport = async () => {
    if (!selectedReportId) return;
    setLoading(true);
    try {
      let url = `/api/reports/${selectedReportId}?format=html`;
      if (storeId) url += `&store_id=${encodeURIComponent(storeId)}`;
      url += `&date_from=${encodeURIComponent(startDate)}&date_to=${encodeURIComponent(endDate)}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setReportData(data.data ?? data ?? []);
        setReportColumns(data.columns ?? (data.length > 0 ? Object.keys(data[0]) : []));
      }
    } catch (err) {
      console.error('runReport error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runReport();
  }, [selectedReportId, startDate, endDate, storeId]);

  const exportReport = async (fmt: 'csv' | 'pdf') => {
    if (!selectedReportId) return;
    try {
      let url = `/api/reports/${selectedReportId}?format=${fmt}`;
      if (storeId) url += `&store_id=${encodeURIComponent(storeId)}`;
      url += `&date_from=${encodeURIComponent(startDate)}&date_to=${encodeURIComponent(endDate)}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const filename = `report_${selectedReportId}_${startDate}_to_${endDate}.${fmt === 'csv' ? 'csv' : 'pdf'}`;
        const url_ = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url_;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url_);
      }
    } catch (err) {
      console.error('exportReport error:', err);
    }
  };

  const preset = (days: number) => {
    setStartDate(dateNDaysAgo(days));
    setEndDate(new Date().toISOString().slice(0, 10));
  };

  const selectedReport = selectedReportId ? REPORTS.find((r) => r.id === selectedReportId) : null;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Reporting</h1>
          <p>Generate and export business reports</p>
        </div>
      </div>

      {/* Hero Filter Section */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
            <label className="form-label">Report Type</label>
            <select className="form-input" value={selectedReportId || ''} onChange={(e) => setSelectedReportId(e.target.value || null)}>
              <option value="">— Select a report —</option>
              {REPORTS.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
            <label className="form-label">Date Range</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
            <label className="form-label">Store</label>
            <select className="form-input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">All Stores</option>
              {stores.map((s) => (
                <option key={s.store_id} value={s.store_id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 120px', minWidth: '120px' }}>
            <label className="form-label">Format</label>
            <select className="form-input" value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="html">HTML</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={runReport} disabled={!selectedReportId || loading}>
              {loading ? 'Running…' : 'Run Report'}
            </button>
            <button className="btn btn-secondary" onClick={() => exportReport('csv')} disabled={!selectedReportId || loading || reportData.length === 0}>
              Export CSV
            </button>
            <button className="btn btn-secondary" onClick={() => exportReport('pdf')} disabled={!selectedReportId || loading || reportData.length === 0}>
              Export PDF
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => preset(0)}>Today</button>
          <button className="btn btn-ghost btn-sm" onClick={() => preset(6)}>Last 7 Days</button>
          <button className="btn btn-ghost btn-sm" onClick={() => preset(29)}>Last 30 Days</button>
        </div>
      </div>

      {/* Report List (when no report selected) or Report View */}
      {selectedReport ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2>{selectedReport.title}</h2>
              <p style={{ color: 'var(--text-muted)' }}>{selectedReport.description}</p>
            </div>
            <button className="btn btn-ghost" onClick={() => setSelectedReportId(null)}>← Back to Reports</button>
          </div>

          {loading ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Generating report…</p>
            </div>
          ) : reportData.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
              <h3>No data found</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                Try adjusting the date range or store filter.
              </p>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card-hover)', textAlign: 'left' }}>
                    {reportColumns.map((col) => (
                      <th key={col} style={{ padding: '12px', borderBottom: '2px solid var(--border-medium)' }}>
                        {col.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      {reportColumns.map((col) => (
                        <td key={col} style={{ padding: '10px 12px' }}>
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : '—'}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Available Reports</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {REPORTS.map((r) => (
              <div
                key={r.id}
                className="report-card"
                style={{
                  padding: '20px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'var(--bg-card)',
                }}
                onClick={() => setSelectedReportId(r.id)}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  {r.category}
                </div>
                <h4 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>{r.title}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}