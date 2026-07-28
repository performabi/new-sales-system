import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

export default function CashbackConfig() {
  const { cashbackPercent, fetchCashbackPercent, updateCashbackPercent } = useAppStore();

  const [percent, setPercent] = useState('5');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCashbackPercent();
  }, [fetchCashbackPercent]);

  useEffect(() => {
    if (cashbackPercent !== null) {
      setPercent(String(cashbackPercent));
    }
  }, [cashbackPercent]);

  const handleSave = async () => {
    setSaving(true);
    await updateCashbackPercent(parseFloat(percent) || 0);
    setSaving(false);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Loyalty Cashback</h1>
        <p style={{ color: 'var(--text-muted)' }}>Set the cashback percentage earned on all loyalty purchases.</p>
      </div>

      <div className="card" style={{ maxWidth: '500px', padding: '24px' }}>
        <div className="form-group">
          <label className="form-label">Cashback Percentage (%)</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              className="form-input"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              style={{ maxWidth: '150px' }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              e.g. 5 = 5% of each purchase added as cashback
            </span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
