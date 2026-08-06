import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Tenant, TenantPlan } from '../../types';

interface MainUser {
  user_id: string;
  email: string;
  full_name: string;
  username: string;
  role: string;
  is_active: boolean;
  requires_password_change: boolean;
  auth: {
    confirmed_at: string | null;
    last_sign_in_at: string | null;
    invited_at: string | null;
  };
}

function StatusMessage({ msg }: { msg: string | null }) {
  if (!msg) return null;
  const isError = msg.startsWith('Error');
  return (
    <div style={{ fontSize: '0.85rem', marginTop: '12px', color: isError ? '#ef4444' : '#088f8f' }}>
      {isError ? '❌ ' : '✅ '}
      {msg}
    </div>
  );
}

export default function AdminTenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<TenantPlan[]>([]);

  // Tenant edit form
  const [tName, setTName] = useState('');
  const [tSlug, setTSlug] = useState('');
  const [tDomain, setTDomain] = useState('');
  const [tPlanId, setTPlanId] = useState('');
  const [tIsActive, setTIsActive] = useState(true);
  const [tenantSaving, setTenantSaving] = useState(false);
  const [tenantMsg, setTenantMsg] = useState<string | null>(null);

  // Main user
  const [mainUser, setMainUser] = useState<MainUser | null>(null);
  const [mainUserLoading, setMainUserLoading] = useState(true);

  const [muFullName, setMuFullName] = useState('');
  const [muUsername, setMuUsername] = useState('');
  const [muEmail, setMuEmail] = useState('');
  const [muIsActive, setMuIsActive] = useState(true);
  const [muSaving, setMuSaving] = useState(false);
  const [muMsg, setMuMsg] = useState<string | null>(null);

  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const [tempPwd, setTempPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/tenants');
        if (res.ok) {
          const all: Tenant[] = await res.json();
          const found = all.find((t) => t.tenant_id === tenantId) || null;
          setTenant(found);
          if (found) {
            setTName(found.name);
            setTSlug(found.slug);
            setTDomain(found.domain || '');
            setTPlanId(found.plan_id || '');
            setTIsActive(found.is_active);
          }
        }
      } catch {
        console.warn('Failed to fetch tenant');
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/admin/plans');
        if (res.ok) setPlans(await res.json());
      } catch {
        console.warn('Failed to fetch plans');
      }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/admin/tenants/${tenantId}/main-user`);
        if (res.ok) {
          const user: MainUser = await res.json();
          setMainUser(user);
          setMuFullName(user.full_name);
          setMuUsername(user.username);
          setMuEmail(user.email);
          setMuIsActive(user.is_active);
        }
      } catch {
        console.warn('Failed to fetch main user');
      } finally {
        setMainUserLoading(false);
      }
    })();
  }, [tenantId]);

  const saveTenant = async () => {
    if (!tenant) return;
    setTenantSaving(true);
    setTenantMsg(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.tenant_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tName, slug: tSlug, domain: tDomain, plan_id: tPlanId, is_active: tIsActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setTenantMsg(data.warning || 'Tenant updated');
      setTenant({ ...tenant, name: tName, slug: tSlug, domain: tDomain, plan_id: tPlanId, is_active: tIsActive });
    } catch (e) {
      setTenantMsg(`Error: ${(e as Error).message}`);
    } finally {
      setTenantSaving(false);
    }
  };

  const saveMainUser = async () => {
    if (!tenant || !mainUser) return;
    setMuSaving(true);
    setMuMsg(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.tenant_id}/main-user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: mainUser.user_id,
          full_name: muFullName,
          username: muUsername,
          email: muEmail,
          is_active: muIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMuMsg((data.warning ? `${data.warning} ` : '') + 'Main user updated');
      setMainUser({ ...mainUser, full_name: muFullName, username: muUsername, email: muEmail, is_active: muIsActive });
    } catch (e) {
      setMuMsg(`Error: ${(e as Error).message}`);
    } finally {
      setMuSaving(false);
    }
  };

  const resendInvite = async () => {
    if (!tenant || !mainUser) return;
    setResending(true);
    setResendMsg(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.tenant_id}/main-user/resend-invite`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setResendMsg(
        data.method === 'invite'
          ? 'Access invitation email sent'
          : 'Password reset email sent to the main user'
      );
    } catch (e) {
      setResendMsg(`Error: ${(e as Error).message}`);
    } finally {
      setResending(false);
    }
  };

  const resetPassword = async () => {
    if (!tenant || !mainUser) return;
    setPwdSaving(true);
    setPwdMsg(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.tenant_id}/main-user/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: mainUser.user_id, new_password: tempPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setPwdMsg((data.warning ? `${data.warning} ` : '') + 'Password reset. User must change it at next login.');
      setTempPwd('');
    } catch (e) {
      setPwdMsg(`Error: ${(e as Error).message}`);
    } finally {
      setPwdSaving(false);
    }
  };

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

  const confirmed = !!mainUser?.auth.confirmed_at;

  return (
    <div style={{ maxWidth: '1100px' }}>
      <button
        className="btn btn-ghost"
        onClick={() => navigate('/admin/tenants')}
        style={{ marginBottom: '20px' }}
      >
        ← Back to Tenants
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* ---- Tenant info card ---- */}
        <div className="card">
          <h2 style={{ marginBottom: '20px' }}>{tenant.name}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', fontSize: '0.9rem', marginBottom: '24px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Tenant ID</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{tenant.tenant_id}</span>
            <span style={{ color: 'var(--text-muted)' }}>Schema</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{tenant.schema_name}</span>
            <span style={{ color: 'var(--text-muted)' }}>Status</span>
            <span>
              <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-danger'}`}>
                {tenant.is_active ? 'Active' : 'Inactive'}
              </span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>Created</span>
            <span>{new Date(tenant.created_at).toLocaleDateString()}</span>
          </div>

          <h3 style={{ fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-muted)' }}>Edit company</h3>

          <label className="form-label">Company name</label>
          <input className="form-input" value={tName} onChange={(e) => setTName(e.target.value)} />

          <label className="form-label">Slug</label>
          <input
            className="form-input"
            value={tSlug}
            onChange={(e) => setTSlug(e.target.value.toLowerCase())}
            style={{ fontFamily: 'monospace' }}
          />

          <label className="form-label">Domain (optional)</label>
          <input className="form-input" value={tDomain} onChange={(e) => setTDomain(e.target.value)} placeholder="example.com" />

          <label className="form-label">Plan</label>
          <select className="form-input" value={tPlanId} onChange={(e) => setTPlanId(e.target.value)}>
            <option value="">No plan</option>
            {plans.map((p) => (
              <option key={p.plan_id} value={p.plan_id}>
                {p.name}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
            <input
              type="checkbox"
              id="tenant-active"
              checked={tIsActive}
              onChange={(e) => setTIsActive(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="tenant-active" style={{ fontSize: '0.9rem' }}>Tenant is active</label>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button className="btn btn-primary" onClick={saveTenant} disabled={tenantSaving}>
              {tenantSaving ? 'Saving…' : 'Save tenant'}
            </button>
          </div>
          <StatusMessage msg={tenantMsg} />
        </div>

        {/* ---- Main user card ---- */}
        <div className="card">
          <h2 style={{ marginBottom: '4px', fontSize: '1.2rem' }}>Main User</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            The administrator who manages this tenant
          </p>

          {mainUserLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
            </div>
          ) : !mainUser ? (
            <p style={{ color: 'var(--text-muted)' }}>No main user found for this tenant.</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', fontSize: '0.9rem', marginBottom: '20px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <span>
                  <span className={`badge ${confirmed ? 'badge-success' : 'badge-warning'}`}>
                    {confirmed ? 'Confirmed' : 'Pending invitation'}
                  </span>
                  {!mainUser.is_active && <span className="badge badge-danger" style={{ marginLeft: '8px' }}>Disabled</span>}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>Role</span>
                <span>{mainUser.role}</span>
                <span style={{ color: 'var(--text-muted)' }}>Last login</span>
                <span>{mainUser.auth.last_sign_in_at ? new Date(mainUser.auth.last_sign_in_at).toLocaleString() : 'Never'}</span>
                <span style={{ color: 'var(--text-muted)' }}>Invited</span>
                <span>{mainUser.auth.invited_at ? new Date(mainUser.auth.invited_at).toLocaleString() : '—'}</span>
                <span style={{ color: 'var(--text-muted)' }}>Force change</span>
                <span>{mainUser.requires_password_change ? <span style={{ color: '#f59e0b' }}>Yes</span> : 'No'}</span>
              </div>

              <h3 style={{ fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-muted)' }}>Edit user</h3>

              <label className="form-label">Full name</label>
              <input className="form-input" value={muFullName} onChange={(e) => setMuFullName(e.target.value)} />

              <label className="form-label">Username</label>
              <input className="form-input" value={muUsername} onChange={(e) => setMuUsername(e.target.value)} />

              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={muEmail} onChange={(e) => setMuEmail(e.target.value)} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                Changing the email sends a confirmation email to the new address before it takes effect.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
                <input
                  type="checkbox"
                  id="mu-active"
                  checked={muIsActive}
                  onChange={(e) => setMuIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="mu-active" style={{ fontSize: '0.9rem' }}>User is active</label>
              </div>

              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-primary" onClick={saveMainUser} disabled={muSaving}>
                  {muSaving ? 'Saving…' : 'Save user'}
                </button>
              </div>
              <StatusMessage msg={muMsg} />

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-medium)', margin: '24px 0' }} />

              <h3 style={{ fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-muted)' }}>Access</h3>

              <button className="btn btn-ghost" onClick={resendInvite} disabled={resending} style={{ width: '100%' }}>
                {resending ? 'Sending…' : 'Send Access Email Again'}
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                {confirmed
                  ? 'Sends a password reset email so the user can regain access.'
                  : 'Sends a fresh invitation email to accept and set a password.'}
              </p>
              <StatusMessage msg={resendMsg} />

              <label className="form-label" style={{ marginTop: '20px' }}>Reset password</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  className="form-input"
                  type="text"
                  value={tempPwd}
                  onChange={(e) => setTempPwd(e.target.value)}
                  placeholder="Temporary password (min 6 chars)"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={resetPassword} disabled={pwdSaving || !tempPwd}>
                  {pwdSaving ? 'Resetting…' : 'Reset'}
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                The user will be forced to change the password at their next login.
              </p>
              <StatusMessage msg={pwdMsg} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
