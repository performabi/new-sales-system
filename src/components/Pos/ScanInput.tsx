import { useState, useRef, useEffect } from 'react';
import type { Plu } from '../../types';

interface ScanInputProps {
  onPluFound: (plu: Plu) => void;
  onBarcodeLookup: (barcode: string) => Promise<Plu | null>;
}

export default function ScanInput({ onPluFound, onBarcodeLookup }: ScanInputProps) {
  const [buffer, setBuffer] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard wedge handler: capture rapid keystrokes (barcode scanner emulates keyboard)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.length > 3) {
          e.preventDefault();
          const code = buffer;
          setBuffer('');
          handleBarcode(code);
        }
        return;
      }
      if (e.key.length === 1 && e.key !== ' ') {
        setBuffer((prev) => prev + e.key);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setBuffer(''), 200);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [buffer]);

  const handleBarcode = async (code: string) => {
    setSearching(true);
    try {
      const plu = await onBarcodeLookup(code);
      if (plu) onPluFound(plu);
    } finally {
      setSearching(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualBarcode.trim()) return;
    await handleBarcode(manualBarcode.trim());
    setManualBarcode('');
  };

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '8px', flexShrink: 0 }}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Type barcode manually…"
        value={manualBarcode}
        onChange={(e) => setManualBarcode(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
      />
      <button className="btn btn-primary" onClick={handleManualSubmit} disabled={searching || !manualBarcode.trim()}>
        {searching ? '…' : 'Search'}
      </button>
    </div>
  );
}
