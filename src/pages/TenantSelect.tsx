// src/pages/TenantSelect.tsx
import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface TenantInfo {
  schema: string;
  name: string;
  slug: string;
}

export default function TenantSelect() {
  const navigate = useNavigate();
  const { session, pendingTenants, selectTenant, signOut } = useAuthStore();
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const schemas = useAuthStore.getState().pendingTenants || [];
      const infos: TenantInfo[] = [];
      for (const schema of schemas) {
        try {
          const res = await fetch(`/api/app/tenant-info?tenant_schema=${encodeURIComponent(schema)}`);
          if (res.ok) {
            const tenant = await res.json();
            infos.push({ schema, name: tenant.name || schema, slug: tenant.slug || schema });
          } else {
            infos.push({ schema, name: schema, slug: schema });
          }
        } catch {
          infos.push({ schema, name: schema, slug: schema });
        }
      }
      if (!cancelled) {
        setTenants(infos);
        if (infos.length > 0) setSelectedSchema(infos[0].schema);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) return <Navigate to="/" replace />;
  if (!pendingTenants || pendingTenants.length === 0) return <Navigate to="/" replace />;

  const handleContinue = async () => {
    if (!selectedSchema) {
      setError('Please select a tenant');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const { slug, role, error: err } = await selectTenant(selectedSchema);
    if (err) {
      setError(err);
      setIsSubmitting(false);
      return;
    }
    if (role === 'user') {
      const profile = useAuthStore.getState().profile;
      sessionStorage.removeItem('pos_session');
      if (profile?.assigned_store_id) {
        sessionStorage.setItem('pos_store_id', profile.assigned_store_id);
        if (profile.assigned_store_name) {
          sessionStorage.setItem('pos_store_name', profile.assigned_store_name);
        }
        navigate('/pos/dashboard', { replace: true });
      } else {
        sessionStorage.removeItem('pos_store_id');
        sessionStorage.removeItem('pos_store_name');
        navigate('/pos/select-store', { replace: true });
      }
      return;
    }
    navigate(slug ? `/app/${slug}/dashboard` : '/app/dashboard', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%', animation: 'fadeIn 0.25s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏢</div>
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Select a Tenant</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '0.9rem' }}>
            Your account has access to multiple tenants. Choose which one you want to open.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="tenant-select">Tenant</label>
          <select
            id="tenant-select"
            className="form-select"
            value={selectedSchema}
            onChange={(e) => setSelectedSchema(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.schema} value={t.schema}>
                {t.slug}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="form-error" style={{ marginBottom: '16px', textAlign: 'center' }}>{error}</div>}

        <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={handleContinue} disabled={isSubmitting}>
          {isSubmitting ? 'Opening...' : 'Continue'}
        </button>

        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: '8px', fontSize: '0.85rem' }}
          onClick={async () => {
            await signOut();
            navigate('/', { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
