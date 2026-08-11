import { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import { deviceManager } from '../../devices/DeviceManager';
import type { Plu } from '../../types';

interface WeightModalProps {
  isOpen: boolean;
  plu: Plu | null;
  pricePerKg: number;
  currencySymbol: string;
  onConfirm: (kg: number) => void;
  onCancel: () => void;
}

export default function WeightModal({ isOpen, plu, pricePerKg, currencySymbol, onConfirm, onCancel }: WeightModalProps) {
  const [liveWeight, setLiveWeight] = useState<number | null>(null);
  const [scaleConnected, setScaleConnected] = useState(false);
  const [manualKg, setManualKg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setManualKg('');
    setLiveWeight(null);
    let cancelled = false;
    const scale = deviceManager.getScale();
    (async () => {
      const ok = await scale.connect();
      if (!cancelled) setScaleConnected(ok);
    })();
    const read = async () => {
      const w = await scale.readWeight();
      if (!cancelled && w !== null) setLiveWeight(w);
    };
    read();
    const interval = setInterval(read, 800);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isOpen]);

  if (!isOpen || !plu) return null;

  const parsed = parseFloat(manualKg);
  const kg = parsed > 0 ? parsed : liveWeight ?? 0;
  const price = pricePerKg * kg;
  const canConfirm = kg > 0;

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm(kg);
    setManualKg('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Weigh Item">
      <div style={{ minWidth: '320px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{plu.name}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {currencySymbol}{pricePerKg.toFixed(2)} / kg
          </div>
        </div>

        <div style={{
          textAlign: 'center', marginBottom: '20px', padding: '16px',
          border: '1px solid var(--border-medium)', borderRadius: '12px',
          background: 'rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Scale Weight {scaleConnected ? '— live' : '(not connected)'}
          </div>
          <div style={{
            fontSize: '2.2rem', fontWeight: 700, fontFamily: 'monospace',
            color: scaleConnected ? 'var(--accent)' : 'var(--text-muted)',
          }}>
            {liveWeight !== null ? `${liveWeight.toFixed(3)} kg` : '— kg'}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>Manual Weight (kg)</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              className="form-input"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.000"
              value={manualKg}
              onChange={(e) => setManualKg(e.target.value)}
              style={{ flex: 1, fontFamily: 'monospace' }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setManualKg(liveWeight !== null ? liveWeight.toFixed(3) : '')} disabled={liveWeight === null}>
              Use Scale
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Price</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'monospace' }}>
            {currencySymbol}{price.toFixed(2)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={!canConfirm}>
            Add to Basket
          </button>
        </div>
      </div>
    </Modal>
  );
}
