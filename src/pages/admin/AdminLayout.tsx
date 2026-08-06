import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/tenants', label: 'Tenants', icon: '🏢' },
  { path: '/admin/super-users', label: 'Team', icon: '👥' },
  { path: '/admin/plans', label: 'Plans', icon: '📋' },
  { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { superUser, signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    document.title = 'System Admin';
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const sidebarWidth = collapsed ? '72px' : '240px';

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
      <aside style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        background: 'linear-gradient(180deg, #004f6d 0%, #088f8f 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        transition: 'width 0.2s, min-width 0.2s',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: collapsed ? '16px 0' : '24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexDirection: collapsed ? 'column' : 'row',
          gap: collapsed ? '8px' : '0',
        }}>
          {collapsed ? (
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>⚙️</div>
          ) : (
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>⚙️ Admin</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                {superUser?.full_name}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#67ffa6', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                {superUser?.role === 'super_admin' ? 'Super Admin' : 'Support'}
              </div>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.8rem',
              borderRadius: '4px',
              padding: collapsed ? '4px 6px' : '4px 8px',
              lineHeight: 1,
              alignSelf: collapsed ? 'auto' : 'flex-start',
              marginTop: collapsed ? '0' : '0',
            }}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? '0' : '12px',
                width: '100%',
                padding: collapsed ? '12px 0' : '10px 20px',
                border: 'none',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                fontSize: collapsed ? '1.2rem' : '0.9rem',
                textAlign: collapsed ? 'center' : 'left',
                transition: 'all 0.15s',
                borderLeft: collapsed ? 'none' : (isActive ? '3px solid #67ffa6' : '3px solid transparent'),
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
            );
          })}
        </nav>

        <div style={{
          padding: collapsed ? '8px' : '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {collapsed ? (
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '8px 0',
                width: '100%',
                textAlign: 'center',
              }}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          ) : (
            <button
              onClick={toggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ fontSize: '0.95rem' }}>{theme === 'light' ? '🌙' : '☀️'}</span>
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? '0' : '12px',
              width: '100%',
              padding: collapsed ? '8px 0' : '10px 0',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: collapsed ? '1rem' : '0.85rem',
            }}
          >
            <span>🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', padding: '32px', transition: 'padding 0.2s' }}>
        <Outlet />
      </main>
    </div>
  );
}
