import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiFetch } from '../../lib/api';
import type { Tenant } from '../../types';

export default function AdminDashboard() {
  const { superUser } = useAuthStore();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, trial: 0 });

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    try {
      const res = await apiFetch('/api/admin/tenants');
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
        setStats({
          total: data.length,
          active: data.filter((t: Tenant) => t.is_active).length,
          trial: data.filter((t: any) => t.subscription_status === 'trial').length,
        });
      }
    } catch {
      console.warn('Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    { label: 'Provision Tenant', icon: '🏢', path: '/admin/tenants/provision', color: '#088f8f' },
    { label: 'View Tenants', icon: '📋', path: '/admin/tenants', color: '#004f6d' },
    { label: 'Manage Team', icon: '👥', path: '/admin/super-users', color: '#088f8f' },
    { label: 'Plans', icon: '📋', path: '/admin/plans', color: '#004f6d' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>System Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          Welcome back, {superUser?.full_name}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#088f8f' }}>{loading ? '…' : stats.total}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Total Companies</div>
        </div>
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#67ffa6' }}>{loading ? '…' : stats.active}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Active</div>
        </div>
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffbd59' }}>{loading ? '…' : stats.trial}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>On Trial</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {quickActions.map((action) => (
          <div
            key={action.path}
            className="card"
            style={{
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              borderTop: `3px solid ${action.color}`,
            }}
            onClick={() => navigate(action.path)}
          >
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{action.icon}</div>
            <div style={{ fontWeight: 600 }}>{action.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Recent Companies</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
          </div>
        ) : tenants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No companies yet. <span style={{ color: '#088f8f', cursor: 'pointer' }} onClick={() => navigate('/admin/tenants/provision')}>Provision your first tenant</span>
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Schema</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants.slice(0, 10).map((t) => (
                <tr key={t.tenant_id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.schema_name}</td>
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
        )}
      </div>
    </div>
  );
}
