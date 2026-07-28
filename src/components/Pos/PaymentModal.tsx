import { useState } from 'react';
import Modal from '../UI/Modal';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPay: (method: string, note?: string, amountTendered?: number) => void;
  total: number;
  currencySymbol: string;
}

export default function PaymentModal({ isOpen, onClose, onPay, total, currencySymbol }: PaymentModalProps) {
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [amountTendered, setAmountTendered] = useState(total);
  const [submitting, setSubmitting] = useState(false);

  const change = Math.max(0, amountTendered - total);

  const handleSubmit = async () => {
    setSubmitting(true);
    onPay(method, note || undefined, method === 'cash' ? amountTendered : undefined);
    setSubmitting(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment">
      <div style={{ minWidth: '320px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Due</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)' }}>
            {currencySymbol}{total.toFixed(2)}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>Payment Method</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'contactless', label: 'Contactless' },
              { value: 'transfer', label: 'Bank Transfer' },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`btn ${method === opt.value ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: '0.8rem' }}
                onClick={() => setMethod(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {method === 'cash' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>Amount Tendered</label>
            <input
              type="number"
              step="0.01"
              min={total}
              value={amountTendered}
              onChange={(e) => setAmountTendered(Number(e.target.value) || 0)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'monospace', fontSize: '1.2rem', textAlign: 'right' }}
              autoFocus
            />
            {change > 0 && (
              <div style={{ textAlign: 'right', marginTop: '4px', fontSize: '0.9rem', color: 'var(--accent)' }}>
                Change: {currencySymbol}{change.toFixed(2)}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
              {[5, 10, 20, 50].map((v) => (
                <button key={v} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '8px' }}
                  onClick={() => setAmountTendered(v)}>
                  {currencySymbol}{v}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. card last 4 digits"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '1.1rem' }}
          onClick={handleSubmit}
          disabled={submitting || (method === 'cash' && amountTendered < total)}
        >
          {submitting ? 'Processing…' : `Confirm Payment ${currencySymbol}${total.toFixed(2)}`}
        </button>
      </div>
    </Modal>
  );
}
