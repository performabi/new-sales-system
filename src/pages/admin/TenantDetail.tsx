import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Tenant } from '../../types';

export default function AdminTenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/tenants');
        if (res.ok) {
          const all: Tenant[] = await res.json();
          const found = all.find((t) => t.tenant_id === tenantId);
          setTenant(found || null);
        }
      } catch {
        console.warn('Failed to fetch tenant');
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Tenant not found</p>
        <button className="btn btn-primary" onClick={() => navigate('/admin/tenants')}>Back to Tenants</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <button
        className="btn btn-ghost"
        onClick={() => navigate('/admin/tenants')}
        style={{ marginBottom: '20px' }}
      >
        ← Back to Tenants
      </button>

      <div className="card">
        <h2 style={{ marginBottom: '24px' }}>{tenant.name}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px 16px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Tenant ID</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{tenant.tenant_id}</span>

          <span style={{ color: 'var(--text-muted)' }}>Slug</span>
          <span style={{ fontFamily: 'monospace' }}>{tenant.slug}</span>

          <span style={{ color: 'var(--text-muted)' }}>Schema</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{tenant.schema_name}</span>

          <span style={{ color: 'var(--text-muted)' }}>Plan</span>
          <span>{tenant.plan_name || '—'}</span>

          <span style={{ color: 'var(--text-muted)' }}>Status</span>
          <span>
            <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-danger'}`}>
              {tenant.is_active ? 'Active' : 'Inactive'}
            </span>
          </span>

          <span style={{ color: 'var(--text-muted)' }}>Created</span>
          <span>{new Date(tenant.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
