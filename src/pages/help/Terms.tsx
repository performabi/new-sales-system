export default function Terms() {
  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Terms & Conditions</h1>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>1. Introduction</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          These Terms & Conditions apply to the loyalty scheme operated by [Company Name], trading as Performabi
          ("we", "us", "our"). By registering for a loyalty card you agree to these terms and consent to your
          personal data being processed in accordance with the UK General Data Protection Regulation (UK GDPR)
          and the Data Protection Act 2018.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>2. Information We Collect</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          When you register we collect: your full name, email address, phone number, postcode and preferred
          store. We also hold details of your loyalty card number, cashback balance and purchase history linked
          to your card.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>3. Why We Use Your Data</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          We use your personal data to: operate your loyalty card and calculate cashback, manage your account,
          send loyalty notifications where you have opted in, and for internal record keeping. Processing is
          based on your consent, which you give when you tick the consent box during registration.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>4. Cashback & Card Use</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          Cashback is earned on eligible purchases at the rate displayed in the store. Cashback is non-transferable,
          has no cash value, and may only be used as a discount against future purchases at the registered store.
          We may suspend or withdraw a card if it is used fraudulently or in breach of these terms.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>5. Your Rights</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          Under UK GDPR you have the right to: access a copy of the personal data we hold about you; correct
          inaccurate data; request deletion of your data; and withdraw your consent at any time. Withdrawing
          consent may mean your loyalty card can no longer be used.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>6. Data Retention</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          We keep your data only for as long as your loyalty card is active, plus any period required by law.
          When your card is closed or consent withdrawn, your personal data is removed or anonymised.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>7. Contact</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          Questions about these terms or how we handle your data can be sent to the data protection contact below.
        </p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📧</div>
        <h3>Questions?</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '16px' }}>
          Contact us about your data or the loyalty scheme
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
