import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function ForceChangePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changePassword = useAuthStore((s) => s.changePassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password === 'Sales12345') {
      setError("Please choose a password different from the temporary one.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    const { error: changeError } = await changePassword(password);
    if (changeError) {
      setError(changeError);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <h2>Update Password</h2>
          <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
            You are required to change your temporary password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              disabled={isSubmitting}
            />
          </div>

          {error && <div className="form-error" style={{ marginBottom: '16px', textAlign: 'center' }}>{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Updating...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
