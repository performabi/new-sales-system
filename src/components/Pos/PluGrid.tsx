import type { Plu } from '../../types';

interface PluGridProps {
  items: Plu[];
  storeId: string | null;
  onSelect: (item: Plu) => void;
  getEffectivePrice: (plu: Plu) => number;
}

export default function PluGrid({ items, onSelect, getEffectivePrice }: PluGridProps) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start',
      alignContent: 'flex-start',
      columnGap: '8px', rowGap: 0, padding: '8px', overflowY: 'auto', flex: 1,
    }}>
      {items.map((plu) => {
        const price = getEffectivePrice(plu);
        return (
          <button
            key={plu.plu_id}
            className="btn btn-ghost"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '8px 6px', minHeight: '80px',
              flex: '0 0 120px',
              borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              cursor: 'pointer',
            }}
            onClick={() => onSelect(plu)}
          >
            <span style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '2px' }}>{plu.plu_number}</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2, flex: 1, display: 'flex', alignItems: 'center' }}>
              {plu.name}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 700, marginTop: '4px' }}>
              £{price.toFixed(2)}
            </span>
          </button>
        );
      })}
      {items.length === 0 && (
        <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
          No products
        </div>
      )}
    </div>
  );
}
