// src/components/Layout/Sidebar.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/',          icon: '📊', label: 'Dashboard' },
  { path: '/stores',    icon: '🏪', label: 'Stores' },
  { path: '/users',     icon: '👥', label: 'Users' },
  { path: '/inventory', icon: '📦', label: 'Inventory' },
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
            <div className="brand-text">
              <span className="brand-title">HEAD OFFICE</span>
              <span className="brand-user">{profile?.full_name ?? 'Loading…'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
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
