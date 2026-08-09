import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface PosStore {
  store_id: string;
  name: string;
}

interface PublicTenant {
  tenant_id: string;
  name: string;
  slug: string;
}

const COUNTRY_CODES = [
  { code: '+44', label: '🇬🇧 UK' },
  { code: '+1', label: '🇺🇸 US' },
  { code: '+353', label: '🇮🇪 Ireland' },
  { code: '+33', label: '🇫🇷 France' },
  { code: '+49', label: '🇩🇪 Germany' },
  { code: '+34', label: '🇪🇸 Spain' },
  { code: '+39', label: '🇮🇹 Italy' },
  { code: '+31', label: '🇳🇱 Netherlands' },
  { code: '+48', label: '🇵🇱 Poland' },
  { code: '+30', label: '🇬🇷 Greece' },
  { code: '+351', label: '🇵🇹 Portugal' },
  { code: '+46', label: '🇸🇪 Sweden' },
  { code: '+47', label: '🇳🇴 Norway' },
  { code: '+45', label: '🇩🇰 Denmark' },
  { code: '+358', label: '🇫🇮 Finland' },
  { code: '+61', label: '🇦🇺 Australia' },
  { code: '+64', label: '🇳🇿 New Zealand' },
  { code: '+27', label: '🇿🇦 South Africa' },
  { code: '+91', label: '🇮🇳 India' },
  { code: '+86', label: '🇨🇳 China' },
  { code: '+81', label: '🇯🇵 Japan' },
  { code: '+971', label: '🇦🇪 UAE' },
  { code: '+966', label: '🇸🇦 Saudi Arabia' },
  { code: '+974', label: '🇶🇦 Qatar' },
];

export default function LoyaltyRegister({ tenantSlug }: { tenantSlug?: string }) {
  const [customerName, setCustomerName] = useState('');
  const [countryCode, setCountryCode] = useState('+44');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [postcode, setPostcode] = useState('');
  const [preferredStoreId, setPreferredStoreId] = useState('');
  const [stores, setStores] = useState<PosStore[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ card_number: string; customer_name: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenants, setTenants] = useState<PublicTenant[]>([]);
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  useEffect(() => {
    if (tenantSlug) {
      setResolvedSlug(tenantSlug);
      fetch(`/api/app/tenant-info?slug=${encodeURIComponent(tenantSlug)}`)
        .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
        .then((t) => { if (t?.name) setTenantName(t.name); })
        .catch(() => {});
      return;
    }
    fetch('/api/public/tenants')
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data: PublicTenant[]) => {
        if (data.length === 1) {
          setTenantName(data[0].name);
          setResolvedSlug(data[0].slug);
        } else {
          setTenants(data || []);
        }
      })
      .catch(() => {});
  }, [tenantSlug]);

  useEffect(() => {
    if (!resolvedSlug) return;
    fetch(`/api/stores?tenant_slug=${encodeURIComponent(resolvedSlug)}`)
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data) => setStores(data))
      .catch(() => {});
  }, [resolvedSlug]);

  useEffect(() => {
    if (success) {
      QRCode.toDataURL(`loyalty:${success.card_number}`, { width: 280, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => {});
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedSlug || !customerName.trim() || !phoneNumber.trim() || !email.trim() || !postcode.trim() || !preferredStoreId || !agreeToTerms) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/loyalty-cards/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          phone: `${countryCode} ${phoneNumber.trim()}`,
          email: email.trim(),
          postcode: postcode.trim().toUpperCase(),
          store_id: preferredStoreId,
          tenant_slug: resolvedSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create loyalty card');
        setSubmitting(false);
        return;
      }
      setSuccess({ card_number: data.card.card_number, customer_name: data.card.customer_name });
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0a1929' }}>
        <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ marginBottom: '8px' }}>You're all set, {success.customer_name}!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
            Your loyalty card has been created. Show this QR code at the till:
          </p>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '16px',
            display: 'inline-block', marginBottom: '16px',
          }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Loyalty Card QR Code" style={{ width: '240px', height: '240px', display: 'block' }} />
            ) : null}
          </div>
          <div style={{
            background: 'rgba(103,255,166,0.1)', borderRadius: '8px',
            padding: '12px', marginBottom: '20px',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Or enter this number at checkout</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '2px', color: 'var(--accent)' }}>
              {success.card_number}
            </div>
          </div>
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`loyalty-${success.card_number}.png`}
              className="btn btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}
            >
              📥 Download QR Code
            </a>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <a
              href="https://support.apple.com/en-gb/HT204003"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ flex: 1, fontSize: '0.8rem', opacity: 0.7 }}
            >
              🍎 Add to Apple Wallet
            </a>
            <a
              href="https://pay.google.com/intl/en_uk/about/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ flex: 1, fontSize: '0.8rem', opacity: 0.7 }}
            >
              💳 Save to Google Wallet
            </a>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Apple Wallet and Google Wallet integration requires platform setup — coming in a future update.
          </p>
        </div>
      </div>
    );
  }

  if (!resolvedSlug && tenants.length > 1) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0a1929' }}>
        <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏪</div>
            <h2>Choose a Store</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
              Select the store you'd like to join:
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tenants.map((t) => (
              <button
                key={t.tenant_id}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                onClick={() => { setTenantName(t.name); setResolvedSlug(t.slug); }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0a1929' }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💳</div>
          <h2>{tenantName ? `${tenantName} — Join Our Loyalty Scheme` : 'Join Our Loyalty Scheme'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
            Sign up to earn cashback on every purchase
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required disabled={submitting} />
          </div>

          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={submitting} />
          </div>

          <div className="form-group">
            <label className="form-label">Phone *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={submitting}
                style={{ width: '110px', flexShrink: 0, padding: '10px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '0.85rem' }}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label} {c.code}</option>
                ))}
              </select>
              <input
                className="form-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={submitting}
                placeholder="e.g. 7123456789"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Postcode *</label>
            <input className="form-input" value={postcode} onChange={(e) => setPostcode(e.target.value)} required disabled={submitting} placeholder="e.g. SW1A 1AA" />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Preferred Store *</label>
            <select className="form-input" value={preferredStoreId} onChange={(e) => setPreferredStoreId(e.target.value)} required disabled={submitting}>
              <option value="">— Select a store —</option>
              {stores.map((s) => (
                <option key={s.store_id} value={s.store_id}>{s.name}</option>
              ))}
            </select>
          </div>

          {error && <div className="form-error" style={{ marginBottom: '16px', textAlign: 'center' }}>{error}</div>}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px', cursor: 'pointer', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              disabled={submitting}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: 'var(--accent)', flexShrink: 0 }}
            />
            <span>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                Terms & Conditions
              </a>{' '}
              and consent to my personal data being collected and processed in line with UK GDPR, as described in the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                Privacy Policy
              </a>. *
            </span>
          </label>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} disabled={submitting || !customerName.trim() || !phoneNumber.trim() || !email.trim() || !postcode.trim() || !preferredStoreId || !agreeToTerms}>
            {submitting ? 'Creating…' : 'Join Now'}
          </button>
        </form>
      </div>
    </div>
  );
}
