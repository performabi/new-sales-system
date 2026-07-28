import type { PluCategory } from '../../types';

interface CategoryBarProps {
  categories: PluCategory[];
  activeCategory: string | null;
  onSelect: (categoryId: string | null) => void;
}

export default function CategoryBar({ categories, activeCategory, onSelect }: CategoryBarProps) {
  return (
    <div style={{
      display: 'flex', gap: '8px', padding: '8px', overflowX: 'auto',
      background: 'rgba(0,0,0,0.3)', borderRadius: '8px', flexShrink: 0,
    }}>
      <button
        className={`btn ${activeCategory === null ? 'btn-primary' : 'btn-ghost'}`}
        style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.category_id}
          className={`btn ${activeCategory === cat.category_id ? 'btn-primary' : 'btn-ghost'}`}
          style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}
          onClick={() => onSelect(cat.category_id)}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
