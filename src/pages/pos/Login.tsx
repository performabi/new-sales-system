import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function PosLogin() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = sessionStorage.getItem('pos_session');
    if (!stored) return;

    const storeId = sessionStorage.getItem('pos_store_id');

    if (storeId) {
      navigate('/pos/dashboard', { replace: true });
    } else {
      navigate('/pos/select-store', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const state = useAuthStore.getState();
      const tenantSchema = state.activeTenantSchema || state.user?.user_metadata?.tenant_schema as string | undefined;
      const res = await fetch('/api/pos/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, tenant_schema: tenantSchema }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid PIN');
        setIsSubmitting(false);
        return;
      }

      sessionStorage.setItem('pos_session', JSON.stringify(data.user));

      if (data.user.role === 'user' && data.user.assigned_store_id) {
        sessionStorage.setItem('pos_store_id', data.user.assigned_store_id);
        sessionStorage.setItem('pos_store_name', data.user.assigned_store_name || 'Store');
        navigate('/pos/dashboard', { replace: true });
      } else {
        navigate('/pos/select-store', { replace: true });
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
    }
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-primary)' }}>
      <div className="card" style={{ maxWidth: '380px', width: '100%', textAlign: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏪</div>
          <h1>Store Terminal</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '0.9rem' }}>Enter your PIN to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '2rem',
              letterSpacing: '8px',
              fontFamily: 'monospace',
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              color: pin.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {pin.length > 0 ? '•'.repeat(pin.length) : '------'}
            </div>
          </div>

          {error && <div className="form-error" style={{ marginBottom: '16px', textAlign: 'center' }}>{error}</div>}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            maxWidth: '280px',
            margin: '0 auto 20px',
          }}>
            {['1','2','3','4','5','6','7','8','9'].map((d) => (
              <button
                key={d}
                type="button"
                style={{
                  padding: '16px',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
                onClick={() => handleKeypadPress(d)}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              style={{
                padding: '16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                color: 'var(--danger)',
              }}
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              style={{
                padding: '16px',
                fontSize: '1.5rem',
                fontWeight: 600,
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onClick={() => handleKeypadPress('0')}
            >
              0
            </button>
            <button
              type="button"
              style={{
                padding: '16px',
                fontSize: '1.1rem',
                fontWeight: 600,
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onClick={handleBackspace}
            >
              ⌫
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px' }}
            disabled={pin.length < 4 || isSubmitting}
          >
            {isSubmitting ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: '12px', fontSize: '0.85rem' }}
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
