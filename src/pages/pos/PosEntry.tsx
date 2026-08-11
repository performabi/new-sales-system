// src/pages/pos/PosEntry.tsx
// PIN-first terminal entry: standard users open their assigned store;
// admins (super_users) pick a tenant + store after PIN verification.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
  schema_name?: string;
}

interface PosStore {
  store_id: string;
  name: string;
  address: string;
  store_number?: string | null;
}

export default function PosEntry() {
  const [step, setStep] = useState<'pin' | 'store'>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stores, setStores] = useState<PosStore[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const existingStoreId = sessionStorage.getItem('pos_store_id');
    if (existingStoreId) {
      navigate('/pos/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleKeypadPress = (digit: string) => {
    if (pin.length >= 8) return;
    setPin((prev) => prev + digit);
    setPinError('');
  };

  const handleClear = () => {
    setPin('');
    setPinError('');
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError('');
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) return;
    setSubmitting(true);
    setPinError('');
    try {
      const res = await fetch('/api/pos/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || 'Invalid PIN');
        setPin('');
        setSubmitting(false);
        return;
      }
      sessionStorage.setItem('pos_token', data.pending_token || data.pos_token);
      sessionStorage.setItem('pos_user_id', data.user.user_id);
      sessionStorage.setItem('pos_user_name', data.user.full_name || '');
      sessionStorage.setItem('pos_user_role', data.user.role);
      setPin('');
      setSubmitting(false);
      if (data.kind === 'admin') {
        fetchTenants();
      } else {
        sessionStorage.setItem('pos_store_id', data.user.assigned_store_id);
        if (data.user.assigned_store_name) {
          sessionStorage.setItem('pos_store_name', data.user.assigned_store_name);
        }
        navigate('/pos/dashboard', { replace: true });
      }
    } catch {
      setPinError('Network error');
      setSubmitting(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const headers = new Headers();
      const posToken = sessionStorage.getItem('pos_token');
      if (posToken) headers.set('X-POS-Token', posToken);
      const res = await fetch('/api/admin/tenants', { headers });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setTenants(data);
      setStep('store');
      if (data.length === 1) {
        handleTenantSelect(data[0]);
      }
    } catch {
      setPinError('Failed to load tenants');
      setStep('pin');
    }
  };

  const handleTenantSelect = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setLoadingStores(true);
    setStoreError(null);
    try {
      const schema = `tenant_${tenant.tenant_id.replace(/-/g, '')}`;
      const headers = new Headers();
      const posToken = sessionStorage.getItem('pos_token');
      if (posToken) headers.set('X-POS-Token', posToken);
      const res = await fetch(`/api/admin/stores?schema=${encodeURIComponent(schema)}`, { headers });
      if (!res.ok) throw new Error('Failed to load stores');
      const data = await res.json();
      setStores(data);
    } catch (err) {
      setStoreError((err as Error).message || 'Could not load stores');
    } finally {
      setLoadingStores(false);
    }
  };

  const handleStoreSelect = async (store: PosStore) => {
    if (!selectedTenant) { setStep('pin'); return; }
    try {
      const schema = `tenant_${selectedTenant.tenant_id.replace(/-/g, '')}`;
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const posToken = sessionStorage.getItem('pos_token');
      if (posToken) headers.set('X-POS-Token', posToken);
      const res = await fetch('/api/pos/admin-finalize', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tenant_schema: schema, store_id: store.store_id, store_name: store.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to select store');
      if (data.pos_token) {
        sessionStorage.setItem('pos_token', data.pos_token);
      }
      sessionStorage.setItem('pos_store_id', data.user.assigned_store_id);
      sessionStorage.setItem('pos_store_name', data.user.assigned_store_name);
      if (store.store_number) sessionStorage.setItem('pos_store_number', store.store_number);
      navigate('/pos/dashboard', { replace: true });
    } catch {
      setStoreError('Session expired, please re-enter PIN');
      sessionStorage.removeItem('pos_token');
      setStep('pin');
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 16px' }}>
      {step === 'pin' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>POS Access</h1>
            <p style={{ color: 'var(--text-muted)' }}>Enter your 4-8 digit Terminal PIN</p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '2rem', letterSpacing: '8px', margin: '16px 0',
              fontFamily: 'monospace', color: 'var(--text-primary)',
            }}>
              {pin ? '\u2022'.repeat(pin.length) : '\u2014'}
            </div>

            {pinError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px' }}>{pinError}</div>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
              maxWidth: '260px', margin: '0 auto',
            }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  className="btn btn-ghost"
                  style={{ fontSize: '1.3rem', padding: '14px', fontWeight: 700 }}
                  onClick={() => handleKeypadPress(String(n))}
                >
                  {n}
                </button>
              ))}
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.8rem', padding: '14px' }}
                onClick={handleClear}
              >
                CLR
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '1.3rem', padding: '14px', fontWeight: 700 }}
                onClick={() => handleKeypadPress('0')}
              >
                0
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.8rem', padding: '14px' }}
                onClick={handleBackspace}
              >
                {'\u232b'}
              </button>
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: '20px', width: '100%', maxWidth: '260px' }}
              onClick={handlePinSubmit}
              disabled={pin.length < 4 || submitting}
            >
              {submitting ? 'Verifying\u2026' : 'Confirm'}
            </button>
          </div>
        </>
      )}

      {step === 'store' && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <h2>Select Store</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
              Choose a tenant and store to operate in
            </p>
          </div>

          {tenants.length > 1 && (
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Tenant</label>
              <select
                className="form-input"
                value={selectedTenant?.tenant_id || ''}
                onChange={(e) => {
                  const tenant = tenants.find((t) => t.tenant_id === e.target.value);
                  if (tenant) handleTenantSelect(tenant);
                }}
                style={{ maxWidth: '400px' }}
              >
                <option value="">-- Select tenant --</option>
                {tenants.map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedTenant && (
            <>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Stores for <strong>{selectedTenant.name}</strong>
              </p>

              {loadingStores ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
                </div>
              ) : storeError ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>{storeError}</p>
                  <button className="btn btn-primary" onClick={() => handleTenantSelect(selectedTenant)}>Retry</button>
                </div>
              ) : stores.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>No active stores found for this tenant.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                  {stores.map((store) => (
                    <div
                      key={store.store_id}
                      className="card"
                      style={{ cursor: 'pointer', padding: '20px', transition: 'border-color 0.15s' }}
                      onClick={() => handleStoreSelect(store)}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{'\uD83C\uDFEA'}</div>
                      <h3 style={{ marginBottom: '4px' }}>{store.name}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {store.store_number && `#${store.store_number} \u00B7 `}{store.address}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <button
            className="btn btn-ghost"
            style={{ marginTop: '24px' }}
            onClick={() => { setStep('pin'); setPin(''); setPinError(''); setSelectedTenant(null); setStores([]); }}
          >
            {'\u2190 Back to PIN entry'}
          </button>
        </>
      )}
    </div>
  );
}
