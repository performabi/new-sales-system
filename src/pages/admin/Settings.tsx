import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getSupabaseClient } from '../../lib/supabaseClient';

export default function AdminSettings() {
  const { superUser, userType } = useAuthStore();
  const [fullName, setFullName] = useState(superUser?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);
    if (!fullName.trim()) return;
    setSaving(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('super_users')
      .update({ full_name: fullName.trim() })
      .eq('super_user_id', superUser?.super_user_id);
    setSaving(false);
    if (error) {
      setSaveMsg('Error: ' + error.message);
    } else {
      setSaveMsg('Name updated');
      useAuthStore.getState().setSuperUser(
        superUser ? { ...superUser, full_name: fullName.trim() } : null,
      );
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 6) { setPwMsg('Minimum 6 characters'); return; }
    if (newPw !== confirmPw) { setPwMsg('Passwords do not match'); return; }
    setChangingPw(true);
    try {
      const res = await fetch('/api/admin/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: superUser?.super_user_id, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg('Error: ' + (data.error || 'request failed'));
      } else {
        setPwMsg('Password changed');
        setNewPw('');
        setConfirmPw('');
      }
    } catch {
      setPwMsg('Error: network error');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>Settings</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Your system account settings
      </p>

      {/* Profile card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Profile</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 16px', fontSize: '0.9rem', marginBottom: '20px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Email</span>
          <span>{superUser?.email}</span>
          <span style={{ color: 'var(--text-muted)' }}>Role</span>
          <span>
            <span className={`badge ${userType === 'super_admin' ? 'badge-success' : 'badge-warning'}`}>
              {userType === 'super_admin' ? 'Super Admin' : 'Support'}
            </span>
          </span>
        </div>
        <form onSubmit={handleSaveName}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          {saveMsg && (
            <p style={{
              marginTop: '8px',
              fontSize: '0.85rem',
              color: saveMsg.startsWith('Error') ? '#ef4444' : '#088f8f',
            }}>
              {saveMsg.startsWith('Error') ? '❌ ' : '✅ '}{saveMsg}
            </p>
          )}
        </form>
      </div>

      {/* Password card */}
      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Change Password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className="form-input"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {pwMsg && (
            <p style={{
              marginTop: '8px',
              marginBottom: '12px',
              fontSize: '0.85rem',
              color: pwMsg.startsWith('Error') ? '#ef4444' : '#088f8f',
            }}>
              {pwMsg.startsWith('Error') ? '❌ ' : '✅ '}{pwMsg}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={changingPw}>
            {changingPw ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
