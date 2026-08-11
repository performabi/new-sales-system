// src/pages/app/Reporting.tsx — placeholder for upcoming reporting suite
export default function Reporting() {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Reporting</h1>
          <p>Business reports are coming soon</p>
        </div>
      </div>

      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
        <h3 style={{ marginBottom: '8px' }}>Reports — Coming Soon</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto' }}>
          The reporting suite is under construction. Detailed sales, stock and
          loyalty reports will appear here shortly.
        </p>
      </div>
    </div>
  );
}
