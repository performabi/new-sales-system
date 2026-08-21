// src/pages/app/Reporting.tsx — Reports suite with hero filters and report list
import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { apiFetch } from '../../lib/api';
import { REPORTS } from '../../lib/reports';

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
  const [reportSummary, setReportSummary] = useState<Record<string, any> | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'html' | 'csv'>('html');

  useEffect(() => {
    if (stores.length === 0) fetchStores();
  }, [stores.length, fetchStores]);

  const runReport = async () => {
    if (!selectedReportId) return;
    setLoading(true);
    setReportError(null);
    setReportSummary(null);
    try {
      let url = `/api/reports/${selectedReportId}?format=html`;
      if (storeId) url += `&store_id=${encodeURIComponent(storeId)}`;
      url += `&date_from=${encodeURIComponent(startDate)}&date_to=${encodeURIComponent(endDate)}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setReportData(data);
          setReportColumns(data.length > 0 ? Object.keys(data[0]) : []);
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.data)) {
            setReportData(data.data);
            setReportColumns(data.columns ?? (data.data.length > 0 ? Object.keys(data.data[0]) : []));
            if (data.summary) setReportSummary(data.summary);
          } else if (data.summary && data.daily) {
            // legacy shape fallback
            setReportData(data.daily ?? []);
            setReportColumns(data.daily?.length ? Object.keys(data.daily[0]) : []);
            setReportSummary(data.summary);
          } else {
            setReportData([]);
            setReportColumns([]);
          }
        }
      } else {
        const errBody = await res.json().catch(() => null);
        if (res.status === 404) setReportError('This report is coming soon — endpoint not yet implemented.');
        else setReportError(errBody?.error || `Request failed (${res.status})`);
        setReportData([]);
        setReportColumns([]);
      }
    } catch (err) {
      console.error('runReport error:', err);
      setReportError('Network error');
      setReportData([]);
      setReportColumns([]);
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
  const isSnapshot = selectedReportId ? ['stock', 'plu-list', 'users-stores'].includes(selectedReportId) : false;

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

          {!isSnapshot && (
            <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
              <label className="form-label">Date Range</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}
          {isSnapshot && (
            <div style={{ flex: '1 1 150px', minWidth: '150px', alignSelf: 'center', paddingTop: '18px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Snapshot — not date-filtered
            </div>
          )}

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
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={runReport} disabled={!selectedReportId || loading}>
              {loading ? 'Running…' : 'Run Report'}
            </button>
            <button className="btn btn-secondary" onClick={() => exportReport('csv')} disabled={!selectedReportId || loading || reportData.length === 0}>
              Export CSV
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        {!isSnapshot && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => preset(0)}>Today</button>
            <button className="btn btn-ghost btn-sm" onClick={() => preset(6)}>Last 7 Days</button>
            <button className="btn btn-ghost btn-sm" onClick={() => preset(14)}>Last 15 Days</button>
            <button className="btn btn-ghost btn-sm" onClick={() => preset(29)}>Last 30 Days</button>
          </div>
        )}
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
          ) : reportError ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🚧</div>
              <h3>Report unavailable</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>{reportError}</p>
            </div>
          ) : reportData.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
              <h3>No data found</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                No transactions in this period. Try adjusting the date range (e.g. Last 30 Days) or store filter.
              </p>
            </div>
          ) : (
            <>
              {reportSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  {Object.entries(reportSummary).map(([k, v]) => (
                    <div key={k} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              )}
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
            </>
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