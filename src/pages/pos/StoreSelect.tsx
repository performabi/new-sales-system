import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';

interface PosStore {
  store_id: string;
  name: string;
  address: string;
  store_number?: string | null;
}

export default function PosStoreSelect() {
  const [stores, setStores] = useState<PosStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchStores = () => {
    setLoading(true);
    setError(null);
    apiFetch('/api/stores')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load stores');
        return r.json();
      })
      .then((data) => {
        setStores(data);
      })
      .catch((err) => {
        setError(err.message || 'Could not load stores');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const existingStoreId = sessionStorage.getItem('pos_store_id');
    if (existingStoreId) {
      navigate('/pos/dashboard', { replace: true });
      return;
    }
    fetchStores();
  }, [navigate]);

  const handleSelect = (store: PosStore) => {
    sessionStorage.setItem('pos_store_id', store.store_id);
    sessionStorage.setItem('pos_store_name', store.name);
    if (store.store_number) sessionStorage.setItem('pos_store_number', store.store_number);
    navigate('/pos/dashboard', { replace: true });
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>Select Store</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          Choose a store to operate in
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchStores}>Retry</button>
        </div>
      ) : stores.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>No active stores found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {stores.map((store) => (
            <div
              key={store.store_id}
              className="card"
              style={{ cursor: 'pointer', padding: '20px', transition: 'border-color 0.15s' }}
              onClick={() => handleSelect(store)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🏪</div>
              <h3 style={{ marginBottom: '4px' }}>{store.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {store.store_number && `#${store.store_number} · `}{store.address}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
