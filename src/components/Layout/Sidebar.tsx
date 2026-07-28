// src/components/Layout/Sidebar.tsx
import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
    name: 'Operations',
    icon: '🏭',
    items: [
      { path: '/headoffice/plu',                     icon: '🏷️', label: 'PLU' },
      { path: '/headoffice/inventory/purchase-orders', icon: '📝', label: 'Purchase Orders' },
      { path: '/headoffice/inventory',               icon: '📦',  label: 'Inventory' },
    ],
  },
  {
    name: 'Terminal',
    icon: '🖥️',
    items: [
      { path: '/pos/dashboard', icon: '🏪', label: 'Store Terminal' },
    ],
  },
  {
    name: 'Loyalty',
    icon: '💳',
    items: [
      { path: '/headoffice/loyalty-cards', icon: '💳', label: 'Loyalty Cards' },
      { path: '/headoffice/loyalty-notifications', icon: '🔔', label: 'Notifications' },
    ],
  },
  {
    name: 'Setup',
    icon: '⚙️',
    items: [
      { path: '/headoffice/stores',                  icon: '🏪',  label: 'Stores' },
      { path: '/headoffice/users',                   icon: '👥',  label: 'Users' },
      { path: '/headoffice/setup/suppliers',   icon: '🤝', label: 'Suppliers' },
      { path: '/headoffice/setup/categories',  icon: '🗂️', label: 'Categories' },
      { path: '/headoffice/setup/item-sizing', icon: '📐', label: 'Item Sizing' },
      { path: '/headoffice/setup/store-checklists', icon: '✅', label: 'Checklists' },
      { path: '/headoffice/setup/currency-config', icon: '💷', label: 'Currency' },
      { path: '/headoffice/setup/cashback-config', icon: '💰', label: 'Cashback' },
    ],
  },
  {
    name: 'Audit',
    icon: '📋',
    items: [
      { path: '/headoffice/setup/logbook', icon: '📋', label: 'Logbook' },
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
  const { profile, signOut } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({}));

  const toggleSection = useCallback((name: string) => {
    setExpandedSections((prev) => ({ ...prev, [name]: !prev[name] }));
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
      navigate(item.path);
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
              <ThemeToggle />
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Dashboard — always visible, no section */}
        <button
          className={`nav-item ${isActive('/headoffice/dashboard') ? 'active' : ''}`}
          onClick={() => navigate('/headoffice/dashboard')}
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
             {(expandedSections[section.name] ?? false) && section.items.map((item) => (
              <button
                key={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => handleNavClick(item)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className={`nav-item ${isActive('/headoffice/help/faq') ? 'active' : ''}`}
          onClick={() => navigate('/headoffice/help/faq')}
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
