// src/pages/Logbook.tsx
import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store/appStore';

const ENTITY_COLORS: Record<string, string> = {
  PLU:      'var(--primary)',
  Store:    'var(--success)',
  Category: 'var(--warning)',
  User:     '#a78bfa',
};

export default function LogbookPage() {
  const { logEntries, exportLogCsv, fetchLogbook } = useAppStore();
  useEffect(() => {
    fetchLogbook();
  }, []);

  const [searchQ, setSearchQ] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');

  const filtered = useMemo(() => {
    let items = logEntries;
    if (filterEntity !== 'all') items = items.filter((e) => e.entity === filterEntity);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      items = items.filter(
        (e) =>
          e.entityLabel.toLowerCase().includes(q) ||
          e.field.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q) ||
          e.oldValue.toLowerCase().includes(q) ||
          e.newValue.toLowerCase().includes(q),
      );
    }
    return items;
  }, [logEntries, filterEntity, searchQ]);

  const entities = useMemo(
    () => ['all', ...Array.from(new Set(logEntries.map((e) => e.entity)))],
    [logEntries],
  );

  return (
    <div className="page-wrapper" style={{ padding: '24px 28px', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>📋 Change Logbook</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Tracks every field update — old value, new value, who changed it and when.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={exportLogCsv}
          disabled={logEntries.length === 0}
          title="Export full logbook as CSV"
        >
          ⬇️ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="Search record, field, user…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        <select
          className="form-input"
          style={{ maxWidth: 180 }}
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
        >
          {entities.map((ent) => (
            <option key={ent} value={ent}>{ent === 'all' ? 'All types' : ent}</option>
          ))}
        </select>
      </div>

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-card)', borderRadius: 12,
          border: '1px solid var(--border-light)',
          color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📝</div>
          <p style={{ margin: 0, fontWeight: 600 }}>No changes recorded yet</p>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
            Any edits to PLUs, Stores, Categories or Users will appear here.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-header)', borderBottom: '2px solid var(--border-light)' }}>
                {['Date / Time', 'User', 'Type', 'PLU #, Description', 'Field', 'Old Value', 'New Value'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => (
                <tr
                  key={entry.id}
                  style={{
                    background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-base)',
                    borderBottom: '1px solid var(--border-light)',
                  }}
                >
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {new Date(entry.timestamp).toLocaleString('en-GB')}
                  </td>
                  <td style={{ padding: '9px 14px', fontWeight: 600 }}>{entry.username}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#fff',
                      background: ENTITY_COLORS[entry.entity] ?? 'var(--text-muted)',
                    }}>
                      {entry.entity}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.entityLabel}
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {entry.field}
                  </td>
                  <td style={{ padding: '9px 14px', color: '#f87171', fontFamily: 'monospace', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.oldValue || '—'}
                  </td>
                  <td style={{ padding: '9px 14px', color: '#4ade80', fontFamily: 'monospace', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.newValue || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'} shown
          </p>
        </div>
      )}
    </div>
  );
}
