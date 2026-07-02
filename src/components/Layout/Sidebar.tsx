// src/components/Layout/Sidebar.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import './Sidebar.css';

const MAIN_NAV_ITEMS = [
  { path: '/',          icon: '📊', label: 'Dashboard' },
  { path: '/stores',    icon: '🏪', label: 'Stores' },
  { path: '/plu',       icon: '🏷️',  label: 'PLU' },
  { path: '/users',     icon: '👥', label: 'Users' },
  { path: '/inventory', icon: '📦', label: 'Inventory' },
];

const SETUP_NAV_ITEMS = [
  { path: '/setup/categories', icon: '🗂️', label: 'Categories' },
  { path: '/setup/logbook',    icon: '📋', label: 'Logbook' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Toggle Button */}
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
      >
        <span className="toggle-icon">
          {sidebarCollapsed ? '▶' : '◀'}
        </span>
      </button>

      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="brand-icon">🏢</span>
          {!sidebarCollapsed && (
            <div className="brand-text" style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="brand-title">HEAD OFFICE</span>
              <span className="brand-user" style={{ fontWeight: 600 }}>{profile?.full_name ?? 'Loading…'}</span>
              <span className="brand-role" style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginTop: '2px'
              }}>
                {profile?.role?.replace('_', ' ') ?? ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        {MAIN_NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}

        {/* ── Setup Section ── */}
        {!sidebarCollapsed && (
          <div className="sidebar-section-label">Setup</div>
        )}
        {sidebarCollapsed && <div className="sidebar-section-divider" />}
        {SETUP_NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="sidebar-footer">
        <button
          className="nav-item logout-btn"
          onClick={handleLogout}
          title={sidebarCollapsed ? 'Logout' : undefined}
        >
          <span className="nav-icon">🚪</span>
          {!sidebarCollapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
