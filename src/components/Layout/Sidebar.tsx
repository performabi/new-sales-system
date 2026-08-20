// src/components/Layout/Sidebar.tsx
import { useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import ThemeToggle from '../UI/ThemeToggle';
import './Sidebar.css';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  external?: boolean;
}

interface Section {
  name: string;
  icon: string;
  items: NavItem[];
}

const SECTIONS: Section[] = [
  {
    name: 'Reporting',
    icon: '📊',
    items: [
      { path: '/app/reporting', icon: '📈', label: 'Reports' },
    ],
  },
  {
    name: 'Sales',
    icon: '🧾',
    items: [
      { path: '/app/sales', icon: '🧾', label: 'Sales Review' },
    ],
  },
  {
    name: 'Operations',
    icon: '🏭',
    items: [
      { path: '/app/plu',                     icon: '🏷️', label: 'PLU' },
      { path: '/app/inventory/purchase-orders', icon: '📝', label: 'Purchase Orders' },
      { path: '/app/inventory',               icon: '📦',  label: 'Inventory' },
    ],
  },
  {
    name: 'Loyalty',
    icon: '💳',
    items: [
      { path: '/app/loyalty-cards', icon: '💳', label: 'Loyalty Cards' },
      { path: '/app/loyalty-notifications', icon: '🔔', label: 'Notifications' },
    ],
  },
  {
    name: 'Setup',
    icon: '⚙️',
    items: [
      { path: '/app/stores',                  icon: '🏪',  label: 'Stores' },
      { path: '/app/users',                   icon: '👥',  label: 'Users' },
      { path: '/app/setup/suppliers',   icon: '🤝', label: 'Suppliers' },
      { path: '/app/setup/categories',  icon: '🗂️', label: 'Categories' },
      { path: '/app/setup/item-sizing', icon: '📐', label: 'Item Sizing' },
      { path: '/app/setup/store-checklists', icon: '✅', label: 'Checklists' },
      { path: '/app/setup/currency-config', icon: '💷', label: 'Currency' },
      { path: '/app/setup/cashback-config', icon: '💰', label: 'Cashback' },
      { path: '/app/setup/devices', icon: '🖨️', label: 'Devices' },
    ],
  },
  {
    name: 'Audit',
    icon: '📋',
    items: [
      { path: '/app/setup/logbook', icon: '📋', label: 'Logbook' },
    ],
  },
];

function SectionHeader({
  name,
  icon,
  expanded,
  collapsed,
  onToggle,
}: {
  name: string;
  icon: string;
  expanded: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <button
        className={`sidebar-section-header collapsed ${expanded ? 'expanded' : ''}`}
        onClick={onToggle}
        title={name}
      >
        <span className="section-header-icon">{icon}</span>
      </button>
    );
  }
  return (
    <button
      className={`sidebar-section-header${expanded ? '' : ' collapsed'}`}
      onClick={onToggle}
      title={expanded ? `Collapse ${name}` : `Expand ${name}`}
    >
      <span className="section-header-icon">{icon}</span>
      <span className="sidebar-section-label">{name}</span>
      <span className="section-arrow">▼</span>
    </button>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams();
  const appPrefix = `/app/${slug}`;
  const prefixPath = useCallback(
    (path: string) => (path.startsWith('/app/') ? `${appPrefix}${path.slice(4)}` : path),
    [appPrefix],
  );
  const { profile, superUser, userType, signOut } = useAuthStore();
  const displayName = profile?.full_name ?? superUser?.full_name ?? 'Loading…';
  const displayRole = userType === 'super_admin' ? 'System Admin'
    : userType === 'support' ? 'Support'
    : profile?.role?.replace('_', ' ') ?? '';
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({}));

  const toggleSection = useCallback((name: string) => {
    setExpandedSections((prev) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(prev)) next[key] = false;
      next[name] = !prev[name];
      return next;
    });
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) =>
    path.startsWith('mailto:') ? false : location.pathname === path;

  const handleNavClick = (item: NavItem) => {
    if (item.external) {
      window.location.href = item.path;
    } else {
      navigate(prefixPath(item.path));
    }
  };

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
      >
        <span className="toggle-icon">
          {sidebarCollapsed ? '▶' : '◀'}
        </span>
      </button>

      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="brand-icon">🏢</span>
          {!sidebarCollapsed && (
            <div className="brand-text" style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="brand-title">HEAD OFFICE</span>
              <span className="brand-user" style={{ fontWeight: 600 }}>{displayName}</span>
              <span className="brand-role" style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginTop: '2px'
              }}>
                {displayRole}
              </span>
              <ThemeToggle />
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Terminal — above Dashboard, darker button */}
        <button
          className={`nav-item terminal-btn ${isActive('/pos/dashboard') ? 'active' : ''}`}
          onClick={() => navigate('/pos/dashboard')}
          title={sidebarCollapsed ? 'Terminal' : undefined}
        >
          <span className="nav-icon">🖥️</span>
          {!sidebarCollapsed && <span className="nav-label">Terminal</span>}
        </button>

        <div className="sidebar-divider" />

        {/* Dashboard — always visible, no section */}
        <button
          className={`nav-item ${isActive(prefixPath('/app/dashboard')) ? 'active' : ''}`}
          onClick={() => navigate(prefixPath('/app/dashboard'))}
          title={sidebarCollapsed ? 'Dashboard' : undefined}
        >
          <span className="nav-icon">📊</span>
          {!sidebarCollapsed && <span className="nav-label">Dashboard</span>}
        </button>

        {/* Collapsible sections */}
        {SECTIONS.map((section) => (
          <div key={section.name} className="sidebar-section">
             <SectionHeader
               name={section.name}
               icon={section.icon}
                expanded={expandedSections[section.name] ?? false}
                collapsed={sidebarCollapsed}
                onToggle={() => toggleSection(section.name)}
              />
             <div className={`sidebar-section-items ${expandedSections[section.name] ? 'expanded' : ''}`}>
              <div className="sidebar-section-items-inner">
                {section.items.map((item) => (
                  <button
                    key={item.path}
                    className={`nav-item ${isActive(prefixPath(item.path)) ? 'active' : ''}`}
                    onClick={() => handleNavClick(item)}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={() => window.open('/help', '_blank', 'noopener')}
          title={sidebarCollapsed ? 'FAQ & Support' : undefined}
        >
          <span className="nav-icon">❓</span>
          {!sidebarCollapsed && <span className="nav-label">FAQ & Support</span>}
        </button>
        <button
          className="nav-item logout-btn"
          onClick={handleLogout}
          title={sidebarCollapsed ? 'Logout' : undefined}
          style={{ marginTop: '4px' }}
        >
          <span className="nav-icon">🚪</span>
          {!sidebarCollapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
