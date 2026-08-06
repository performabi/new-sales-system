import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Landing() {
  const navigate = useNavigate();

  const { profile, userType, loading, signIn, resetPassword, isRecoveryMode } = useAuthStore();
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (isRecoveryMode) {
      navigate('/reset-password', { replace: true });
      return;
    }

    if (userType === 'super_admin' || userType === 'support') {
      navigate('/admin/dashboard', { replace: true });
    } else if (profile) {
      if (profile.role === 'user') {
        if (profile.assigned_store_id) {
          sessionStorage.setItem('pos_store_id', profile.assigned_store_id);
          if (profile.assigned_store_name) {
            sessionStorage.setItem('pos_store_name', profile.assigned_store_name);
          }
          navigate('/pos/dashboard', { replace: true });
        } else {
          navigate('/pos/select-store', { replace: true });
        }
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    }
  }, [loading, userType, profile, isRecoveryMode, navigate]);

  const handleHOLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: err } = await signIn(email, password);
    setIsSubmitting(false);
    if (err) setError(err);
  };

  if (loading) {    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏢</div>
          <h1>HEAD OFFICE</h1>
          <p style={{ marginTop: '8px' }}>Log in to access the portal</p>
        </div>
        {showForgot ? (
          <>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Enter your email and we'll send you a password reset link.
            </p>
            {resetSent ? (
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📧</div>
                <p>Check your email for the reset link.</p>
                <button className="btn btn-ghost" style={{ marginTop: '16px' }} onClick={() => { setShowForgot(false); setResetSent(false); setError(null); }}>
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={async (e) => { e.preventDefault(); setError(null); setIsSubmitting(true); const { error: err } = await resetPassword(email); setIsSubmitting(false); if (err) { setError(err); } else { setResetSent(true); } }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-email">Email</label>
                  <input id="reset-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} />
                </div>
                {error && <div className="form-error" style={{ marginBottom: '16px', textAlign: 'center' }}>{error}</div>}
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: '8px' }} onClick={() => { setShowForgot(false); setError(null); }}>
                  Back
                </button>
              </form>
            )}
          </>
        ) : (
          <form onSubmit={handleHOLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isSubmitting} />
            </div>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 0', marginBottom: '16px' }} onClick={() => { setShowForgot(true); setError(null); }}>
              Forgot Password?
            </button>
            {error && <div className="form-error" style={{ marginBottom: '16px', textAlign: 'center' }}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={isSubmitting}>
              {isSubmitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
