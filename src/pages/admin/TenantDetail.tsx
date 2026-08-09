import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
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

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

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
        const res = await apiFetch(`/api/admin/tenants/${tenantId}/main-user`);
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
      const res = await apiFetch(`/api/admin/tenants/${tenant.tenant_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tName,
          ...(autoSlug ? { slug: autoSlug } : {}),
          domain: tDomain,
          plan_id: tPlanId,
          is_active: tIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setTenantMsg(data.warning || 'Tenant updated');
      setTenant({ ...tenant, name: tName, ...(autoSlug ? { slug: autoSlug } : {}), domain: tDomain, plan_id: tPlanId, is_active: tIsActive });
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
      const res = await apiFetch(`/api/admin/tenants/${tenant.tenant_id}/main-user`, {
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
      if (!res.ok) {
        if (res.status === 409 && data.error === 'EMAIL_EXISTS' && data.existingUser) {
          setReassignUser(data.existingUser);
          setShowReassignModal(true);
          return;
        }
        throw new Error(data.error || 'Failed to save');
      }
      setMuMsg((data.warning ? `${data.warning} ` : '') + 'Main user updated');
      setMainUser({ ...mainUser, full_name: muFullName, username: muUsername, email: muEmail, is_active: muIsActive });
    } catch (e) {
      setMuMsg(`Error: ${(e as Error).message}`);
    } finally {
      setMuSaving(false);
    }
  };

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignUser, setReassignUser] = useState<{
    id: string;
    email: string;
    full_name: string;
    tenant_schema: string | null;
    confirmed_at: string | null;
    last_sign_in_at: string | null;
  } | null>(null);

  const confirmReassign = async () => {
    if (!tenant || !reassignUser) return;
    setMuSaving(true);
    setMuMsg(null);
    setShowReassignModal(false);
    try {
      const res = await apiFetch(`/api/admin/tenants/${tenant.tenant_id}/main-user/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existing_user_id: reassignUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reassign');
      setMuMsg((data.warning ? `${data.warning} ` : '') + 'Main user reassigned');
      // Refresh main user data
      const refreshRes = await apiFetch(`/api/admin/tenants/${tenant.tenant_id}/main-user`);
      if (refreshRes.ok) {
        const user: MainUser = await refreshRes.json();
        setMainUser(user);
        setMuFullName(user.full_name);
        setMuUsername(user.username);
        setMuEmail(user.email);
        setMuIsActive(user.is_active);
      }
    } catch (e) {
      setMuMsg(`Error: ${(e as Error).message}`);
    } finally {
      setMuSaving(false);
      setReassignUser(null);
    }
  };

  const cancelReassign = () => {
    setShowReassignModal(false);
    setReassignUser(null);
  };

  const resendInvite = async () => {
    if (!tenant || !mainUser) return;
    setResending(true);
    setResendMsg(null);
    try {
      const res = await apiFetch(`/api/admin/tenants/${tenant.tenant_id}/main-user/resend-invite`, {
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

  const inviteMainUser = async () => {
    if (!tenant) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await apiFetch(`/api/admin/tenants/${tenant.tenant_id}/main-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite');
      setInviteMsg((data.warning ? `${data.warning} ` : '') + 'Invitation email sent');
    } catch (e) {
      setInviteMsg(`Error: ${(e as Error).message}`);
    } finally {
      setInviting(false);
    }
  };

  const resetPassword = async () => {
    if (!tenant || !mainUser) return;
    setPwdSaving(true);
    setPwdMsg(null);
    try {
      const res = await apiFetch(`/api/admin/tenants/${tenant.tenant_id}/main-user/reset-password`, {
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
  const autoSlug = tName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const initials = (mainUser?.full_name || mainUser?.email || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <div style={{ maxWidth: '1100px' }}>
      <button
        className="btn btn-ghost"
        onClick={() => navigate('/admin/tenants')}
        style={{ marginBottom: '20px' }}
      >
        ← Back to Tenants
      </button>

      {/* ---- Header strip: read-only summary ---- */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h2 style={{ margin: 0 }}>{tenant.name}</h2>
          <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-danger'}`}>
            {tenant.is_active ? 'Active' : 'Inactive'}
          </span>
          {tenant.plan_name && <span className="badge badge-info">{tenant.plan_name}</span>}
          {tenant.subscription_status && (
            <span className="badge badge-secondary">{tenant.subscription_status}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span>
            Tenant ID <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{tenant.tenant_id}</span>
          </span>
          <span>
            Schema <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{tenant.schema_name}</span>
          </span>
          <span>
            Portal{' '}
            <a
              href={`${window.location.origin}/app/${tenant.slug}/dashboard`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)' }}
            >
              {window.location.origin}/app/{tenant.slug}/dashboard
            </a>
          </span>
          <span>
            Created <span style={{ color: 'var(--text-primary)' }}>{new Date(tenant.created_at).toLocaleDateString()}</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        {/* ---- Company card: edit form only ---- */}
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Company</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 24px' }}>
            <div>
              <label className="form-label">Company name</label>
              <input className="form-input" value={tName} onChange={(e) => setTName(e.target.value)} />
            </div>

            <div>
              <label className="form-label">Domain (optional)</label>
              <input className="form-input" value={tDomain} onChange={(e) => setTDomain(e.target.value)} placeholder="example.com" />
            </div>

            <div>
              <label className="form-label">Plan</label>
              <select className="form-input" value={tPlanId} onChange={(e) => setTPlanId(e.target.value)}>
                <option value="">No plan</option>
                {plans.map((p) => (
                  <option key={p.plan_id} value={p.plan_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Slug</label>
              <div
                style={{
                  padding: '9px 12px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary, #f5f5f5)',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                  opacity: 0.9,
                }}
              >
                {autoSlug || '—'}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                Auto-generated from the company name.
              </p>
            </div>
          </div>

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
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Main User</h2>

          {mainUserLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
            </div>
          ) : !mainUser ? (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                No main user found for this tenant. Invite one to grant them access.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 24px' }}>
                <div>
                  <label className="form-label">Full name</label>
                  <input className="form-input" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-primary" onClick={inviteMainUser} disabled={inviting || !inviteEmail || !inviteName}>
                  {inviting ? 'Sending…' : 'Invite main user'}
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                An invitation email will be sent so they can set their password and access the tenant.
              </p>
              <StatusMessage msg={inviteMsg} />
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '1.1rem',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{mainUser.full_name || mainUser.email}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{mainUser.email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span className={`badge ${confirmed ? 'badge-success' : 'badge-warning'}`}>
                  {confirmed ? 'Confirmed' : 'Pending invitation'}
                </span>
                {!mainUser.is_active && <span className="badge badge-danger">Disabled</span>}
                {mainUser.requires_password_change && <span className="badge badge-warning">Must change password</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px 16px', fontSize: '0.9rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Role</span>
                <span>{mainUser.role}</span>
                <span style={{ color: 'var(--text-muted)' }}>Last login</span>
                <span>{mainUser.auth.last_sign_in_at ? new Date(mainUser.auth.last_sign_in_at).toLocaleString() : 'Never'}</span>
                <span style={{ color: 'var(--text-muted)' }}>Invited</span>
                <span>{mainUser.auth.invited_at ? new Date(mainUser.auth.invited_at).toLocaleString() : '—'}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-medium)', margin: '20px 0' }} />

              <h3 style={{ fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-muted)' }}>Edit user</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 24px' }}>
                <div>
                  <label className="form-label">Full name</label>
                  <input className="form-input" value={muFullName} onChange={(e) => setMuFullName(e.target.value)} />
                </div>

                <div>
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={muEmail} onChange={(e) => setMuEmail(e.target.value)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id="mu-active"
                      checked={muIsActive}
                      onChange={(e) => setMuIsActive(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <label htmlFor="mu-active" style={{ fontSize: '0.9rem' }}>User is active</label>
                  </div>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                Changing the email sends a confirmation email to the new address before it takes effect.
              </p>

              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-primary" onClick={saveMainUser} disabled={muSaving}>
                  {muSaving ? 'Saving…' : 'Save user'}
                </button>
              </div>
              <StatusMessage msg={muMsg} />

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-medium)', margin: '24px 0' }} />

              <h3 style={{ fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-muted)' }}>Access</h3>

              <button className="btn btn-primary" onClick={resendInvite} disabled={resending} style={{ width: '100%' }}>
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

    {showReassignModal && reassignUser && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}
        onClick={cancelReassign}
      >
        <div
          className="card"
          style={{ maxWidth: '480px', width: '100%', padding: '24px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Email Already Registered</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
            The email <strong>{reassignUser.email}</strong> is already associated with another user:
          </p>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600 }}>{reassignUser.full_name || '—'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{reassignUser.email}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
              {reassignUser.tenant_schema
                ? `Currently main user for tenant: ${reassignUser.tenant_schema}`
                : 'Not currently a main user for any tenant'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
              Status: {reassignUser.confirmed_at ? 'Confirmed' : 'Pending invitation'}
            </div>
            {reassignUser.last_sign_in_at && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                Last sign in: {new Date(reassignUser.last_sign_in_at).toLocaleString()}
              </div>
            )}
          </div>
          <p style={{ color: 'var(--text-danger)', fontSize: '0.9rem', marginBottom: '20px' }}>
            ⚠️ Making this user the main user will <strong>revoke access for the current main user</strong>.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={cancelReassign} disabled={muSaving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirmReassign} disabled={muSaving}>
              {muSaving ? 'Reassigning…' : 'Make Main User'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
