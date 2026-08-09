import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { apiFetch } from '../../lib/api';
import type { SuperUser } from '../../types';

export default function AdminSuperUsers() {
  const { userType } = useAuthStore();
  const [users, setUsers] = useState<SuperUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'super_admin' | 'support'>('support');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await apiFetch('/api/admin/super-users');
      if (res.ok) setUsers(await res.json());
    } catch {
      console.warn('Failed to fetch super users');
    } finally {
      setLoading(false);
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email || !fullName) {
      setError('All fields required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/admin/super-users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to invite');
        return;
      }
      setSuccess(`Invite sent to ${email}`);
      setEmail('');
      setFullName('');
      setRole('support');
      setShowInvite(false);
      fetchUsers();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Team</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            {users.length} system {users.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        {userType === 'super_admin' && (
          <button className="btn btn-primary" onClick={() => setShowInvite(!showInvite)}>
            + Add Member
          </button>
        )}
      </div>

      {success && (
        <div className="card" style={{ padding: '16px', marginBottom: '16px', border: '1px solid #088f8f', background: 'rgba(8,143,143,0.1)' }}>
          <p style={{ color: '#088f8f' }}>✅ {success}</p>
        </div>
      )}

      {showInvite && (
        <div className="card" style={{ maxWidth: '480px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Invite Team Member</h3>
          <form onSubmit={handleInvite}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="super_admin">Super Admin (full access)</option>
                <option value="support">Support (read-only)</option>
              </select>
            </div>
            {error && <div className="form-error" style={{ marginBottom: '12px' }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send Invite'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ marginLeft: '8px' }} onClick={() => setShowInvite(false)}>Cancel</button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.super_user_id}>
                  <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'super_admin' ? 'badge-success' : 'badge-warning'}`}>
                      {u.role === 'super_admin' ? 'Super Admin' : 'Support'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
