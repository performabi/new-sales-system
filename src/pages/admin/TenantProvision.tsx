import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TenantPlan } from '../../types';

export default function AdminTenantProvision() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<TenantPlan[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [planId, setPlanId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/plans')
      .then((r) => r.json())
      .then((data) => {
        setPlans(data);
        if (data.length > 0) setPlanId(data[0].plan_id);
      })
      .catch(() => {});
  }, []);

  const generateSlug = (val: string) => {
    const s = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setSlug(s);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name || !slug || !planId || !adminEmail || !adminName) {
      setError('All fields are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/provision-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, plan_id: planId, admin_email: adminEmail, admin_name: adminName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Provisioning failed');
        return;
      }

      setSuccess(`Tenant "${name}" created! Tenant ID: ${data.tenant_id}. Invite sent to ${adminEmail}.`);
      setName('');
      setSlug('');
      setAdminEmail('');
      setAdminName('');
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/admin/tenants')} style={{ marginBottom: '12px' }}>
          ← Back to Tenants
        </button>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Provision New Company</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          This will create a new database schema, register the tenant, and invite the admin.
        </p>
      </div>

      {success && (
        <div className="card" style={{ padding: '20px', marginBottom: '24px', border: '1px solid #088f8f', background: 'rgba(8,143,143,0.1)' }}>
          <p style={{ color: '#088f8f', fontWeight: 600 }}>✅ {success}</p>
        </div>
      )}

      <div className="card" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="form-input" value={name} onChange={(e) => { setName(e.target.value); generateSlug(e.target.value); }} required />
          </div>

          <div className="form-group">
            <label className="form-label">Slug (URL-friendly)</label>
            <input className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} required style={{ fontFamily: 'monospace' }} />
          </div>

          <div className="form-group">
            <label className="form-label">Plan</label>
            <select className="form-input" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
              <option value="">Select a plan…</option>
              {plans.map((p) => (
                <option key={p.plan_id} value={p.plan_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-medium)', margin: '24px 0' }} />

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            The tenant admin will receive an invite email to set their password.
          </p>

          <div className="form-group">
            <label className="form-label">Admin Email</label>
            <input className="form-input" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Admin Full Name</label>
            <input className="form-input" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
          </div>

          {error && <div className="form-error" style={{ marginBottom: '16px' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={submitting}>
            {submitting ? 'Provisioning…' : 'Provision Tenant'}
          </button>
        </form>
      </div>
    </div>
  );
}
