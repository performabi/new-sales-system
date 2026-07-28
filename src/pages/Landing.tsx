import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Landing() {
  const navigate = useNavigate();

  const { profile, superUser, userType, loading, signIn, signOut, resetPassword, isRecoveryMode } = useAuthStore();
  const [showHOLogin, setShowHOLogin] = useState(false);
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
        navigate('/pos/login', { replace: true });
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

  const handleLogout = async () => {
    await signOut();
  };

  const userDisplayName = superUser?.full_name || profile?.full_name;

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
      </div>
    );
  }

  if (superUser && (userType === 'super_admin' || userType === 'support')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⚙️</div>
          <h1>Welcome, {userDisplayName}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            {userType === 'super_admin' ? 'System Administrator' : 'Support Agent'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div
            className="card"
            style={{ width: '280px', textAlign: 'center', cursor: 'pointer', padding: '32px' }}
            onClick={() => navigate('/admin/dashboard')}
          >
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚙️</div>
            <h3>System Admin</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>
              Manage tenants, plans, team members and system settings
            </p>
            <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }}>
              Open Admin
            </button>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={handleLogout} style={{ marginTop: '16px' }}>
          Logout
        </button>
      </div>
    );
  }

  if (profile && (profile.role === 'super_user' || profile.role === 'admin')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🏢</div>
          <h1>Welcome, {userDisplayName}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            {profile.role === 'super_user' ? 'Company Super User' : 'Company Administrator'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div
            className="card"
            style={{ width: '280px', textAlign: 'center', cursor: 'pointer', padding: '32px' }}
            onClick={() => navigate('/app/dashboard')}
          >
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏢</div>
            <h3>Head Office</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>
              Manage stores, PLUs, users, suppliers, POs and reports
            </p>
            <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }}>
              Open Head Office
            </button>
          </div>
          <div
            className="card"
            style={{ width: '280px', textAlign: 'center', cursor: 'pointer', padding: '32px' }}
            onClick={() => navigate('/pos/dashboard')}
          >
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏪</div>
            <h3>Store Terminal</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>
              POS, deliveries, clock in/out and store operations
            </p>
            <button className="btn btn-secondary" style={{ marginTop: '16px', width: '100%' }}>
              Open Store Terminal
            </button>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={handleLogout} style={{ marginTop: '16px' }}>
          Logout
        </button>
      </div>
    );
  }

  if (showHOLogin) {
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
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: '12px' }} onClick={() => { setShowHOLogin(false); setShowForgot(false); setError(null); }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1>New Sales System</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Select your access point</p>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div
          className="card"
          style={{ width: '280px', textAlign: 'center', cursor: 'pointer', padding: '32px' }}
          onClick={() => setShowHOLogin(true)}
        >
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏢</div>
          <h3>Head Office</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>
            Admin & management portal
          </p>
          <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }}>
            Sign In
          </button>
        </div>
        <div
          className="card"
          style={{ width: '280px', textAlign: 'center', cursor: 'pointer', padding: '32px' }}
          onClick={() => navigate('/pos/login')}
        >
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏪</div>
          <h3>Store Terminal</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>
            POS, deliveries & store operations
          </p>
          <button className="btn btn-secondary" style={{ marginTop: '16px', width: '100%' }}>
            Open POS
          </button>
        </div>
      </div>
    </div>
  );
}
