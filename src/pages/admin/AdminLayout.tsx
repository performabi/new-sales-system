import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/tenants', label: 'Tenants', icon: '🏢' },
  { path: '/admin/super-users', label: 'Team', icon: '👥' },
  { path: '/admin/plans', label: 'Plans', icon: '📋' },
  { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

const POS_ITEM = { path: '/pos/access', label: 'POS Access', icon: '🖥️' };

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { superUser, signOut } = useAuthStore();

  useEffect(() => {
    document.title = 'System Admin';
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
      <aside style={{
        width: '240px',
        minWidth: '240px',
        background: 'linear-gradient(180deg, #004f6d 0%, #088f8f 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
      }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>⚙️ Admin</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
            {superUser?.full_name}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#67ffa6', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
            {superUser?.role === 'super_admin' ? 'Super Admin' : 'Support'}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 20px',
                border: 'none',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                textAlign: 'left',
                transition: 'all 0.15s',
                borderLeft: isActive ? '3px solid #67ffa6' : '3px solid transparent',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
            );
          })}
        </nav>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
          <button
            onClick={() => navigate('/app/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            <span>🏢</span>
            <span>Tenant Portal</span>
          </button>
          <button
            onClick={() => navigate(POS_ITEM.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: location.pathname === POS_ITEM.path ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: location.pathname === POS_ITEM.path ? '#fff' : 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              borderLeft: location.pathname === POS_ITEM.path ? '3px solid #67ffa6' : '3px solid transparent',
            }}
          >
            <span>{POS_ITEM.icon}</span>
            <span>{POS_ITEM.label}</span>
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <Outlet />
      </main>
    </div>
  );
}
