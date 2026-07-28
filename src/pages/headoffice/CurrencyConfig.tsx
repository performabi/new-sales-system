import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

export default function CurrencyConfig() {
  const { currencyConfig, fetchCurrencyConfig, updateCurrencyConfig } = useAppStore();

  const [symbol, setSymbol] = useState('£');
  const [code, setCode] = useState('GBP');
  const [notes, setNotes] = useState('50,20,10,5');
  const [coins, setCoins] = useState('2,1,0.50,0.20,0.10,0.05,0.02,0.01');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrencyConfig();
  }, [fetchCurrencyConfig]);

  useEffect(() => {
    if (currencyConfig) {
      setSymbol(currencyConfig.symbol);
      setCode(currencyConfig.code);
      setNotes(currencyConfig.notes.join(','));
      setCoins(currencyConfig.coins.join(','));
    }
  }, [currencyConfig]);

  const handleSave = async () => {
    setSaving(true);
    await updateCurrencyConfig({
      symbol,
      code,
      notes: notes.split(',').map(Number).filter((n) => !isNaN(n) && n > 0),
      coins: coins.split(',').map(Number).filter((n) => !isNaN(n) && n > 0),
    });
    setSaving(false);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Currency Configuration</h1>
        <p style={{ color: 'var(--text-muted)' }}>Set the currency symbol, code, and available bill/coin denominations for the POS till.</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', padding: '24px' }}>
        <div className="form-group">
          <label className="form-label">Currency Symbol</label>
          <input className="form-input" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="£" />
        </div>
        <div className="form-group">
          <label className="form-label">Currency Code</label>
          <input className="form-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="GBP" />
        </div>
        <div className="form-group">
          <label className="form-label">Available Notes (comma-separated)</label>
          <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="50,20,10,5" />
        </div>
        <div className="form-group">
          <label className="form-label">Available Coins (comma-separated)</label>
          <input className="form-input" value={coins} onChange={(e) => setCoins(e.target.value)} placeholder="2,1,0.50,0.20,0.10,0.05,0.02,0.01" />
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
