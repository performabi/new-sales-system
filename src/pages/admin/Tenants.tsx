import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { Tenant } from '../../types';

export default function AdminTenants() {
  const navigate = useNavigate();
  const { userType } = useAuthStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    try {
      const res = await fetch('/api/admin/tenants');
      if (res.ok) {
        setTenants(await res.json());
      }
    } catch {
      console.warn('Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Tenants</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            {tenants.length} registered {tenants.length === 1 ? 'company' : 'companies'}
          </p>
        </div>
        {userType === 'super_admin' && (
          <button className="btn btn-primary" onClick={() => navigate('/admin/tenants/provision')}>
            + Register New Customer
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : tenants.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          No companies registered yet
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Slug</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.tenant_id}
                  onClick={() => navigate(`/admin/tenants/${t.tenant_id}`)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-light)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.slug}</td>
                  <td>{t.plan_name || '—'}</td>
                  <td>
                    <span className={`badge ${t.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
