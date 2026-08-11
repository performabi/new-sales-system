import { useState } from 'react';
import Modal from '../UI/Modal';
import { useAuthStore } from '../../store/authStore';

interface PinResult {
  user_id: string;
  full_name: string;
  role: string;
}

interface PinPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: PinResult, pin: string) => void;
  title?: string;
}

export default function PinPrompt({ isOpen, onClose, onSuccess, title }: PinPromptProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (pin.length < 4 || pin.length > 8) return;
    setSubmitting(true);
    setError('');
    try {
      const state = useAuthStore.getState();
      const tenantSchema = state.activeTenantSchema || state.user?.user_metadata?.tenant_schema as string | undefined;
      const res = await fetch('/api/pos/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, tenant_schema: tenantSchema, verify_only: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid PIN');
        setPin('');
        setSubmitting(false);
        return;
      }
      const submittedPin = pin;
      setPin('');
      setSubmitting(false);
      onSuccess(data.user, submittedPin);
    } catch {
      setError('Network error');
      setSubmitting(false);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length >= 8) return;
    setPin((prev) => prev + digit);
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Enter Staff PIN'}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '2rem', letterSpacing: '8px', margin: '16px 0',
          fontFamily: 'monospace', color: 'var(--text-primary)',
        }}>
          {pin ? '•'.repeat(pin.length) : '—'}
        </div>

        {error && (
          <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</div>
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
            ⌫
          </button>
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: '20px', width: '100%', maxWidth: '260px' }}
          onClick={handleSubmit}
          disabled={pin.length < 4 || submitting}
        >
          {submitting ? 'Verifying…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
