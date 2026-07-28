import { useEffect, useState } from 'react';
import { deviceManager } from '../../devices/DeviceManager';

interface WeightMonitorProps {
  weight: number | null;
  onWeightChange?: (kg: number) => void;
}

export default function WeightMonitor({ weight, onWeightChange }: WeightMonitorProps) {
  const [connected, setConnected] = useState(false);
  const [liveWeight, setLiveWeight] = useState<number | null>(weight);

  useEffect(() => {
    const scale = deviceManager.getScale();
    if (scale && 'simulateWeight' in scale) {
      setConnected(true);
      const read = async () => {
        const w = await scale.readWeight();
        if (w !== null) {
          setLiveWeight(w);
          onWeightChange?.(w);
        }
      };
      read();
      const interval = setInterval(read, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (weight !== null) setLiveWeight(weight);
  }, [weight]);

  if (!connected && weight === null) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px',
      background: 'rgba(0,0,0,0.3)', borderRadius: '6px', flexShrink: 0,
      fontSize: '0.85rem',
    }}>
      <span style={{ opacity: 0.6 }}>Scale:</span>
      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem',
        color: connected ? 'var(--accent)' : 'var(--text-primary)'
      }}>
        {liveWeight !== null ? `${liveWeight.toFixed(3)} kg` : '—'}
      </span>
      {connected && <span style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>●</span>}
    </div>
  );
}
