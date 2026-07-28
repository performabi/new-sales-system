export default function Faq() {
  return (
    <div className="page-content">
      <div className="page-header">
        <h1>FAQ & Support</h1>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>Frequently Asked Questions</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          FAQ content coming soon.
        </p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📧</div>
        <h3>Need help?</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '16px' }}>
          Contact our support team
        </p>
        <a
          href="mailto:info@performabi.com"
          className="btn btn-primary"
          style={{ display: 'inline-block', padding: '12px 32px', textDecoration: 'none' }}
        >
          Email Support
        </a>
      </div>
    </div>
  );
}
