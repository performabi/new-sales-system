import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import ToastContainer from '../UI/ToastContainer';
import './TerminalLayout.css';

const NAV_ITEMS = [
  { path: '/pos/dashboard',  icon: '🏠', label: 'Home' },
  { path: '/pos/till',       icon: '🧾', label: 'Till' },
  { path: '/pos/transactions', icon: '📋', label: 'Transactions' },
  { path: '/pos/clock',      icon: '⏰', label: 'Clock' },
  { path: '/pos/checklists', icon: '✅', label: 'Checklists' },
  { path: '/pos/goods-in',   icon: '🚚', label: 'Goods In' },
];

function getPosStoreId() {
  const storeId = sessionStorage.getItem('pos_store_id');
  const token = sessionStorage.getItem('pos_token');
  return storeId && token ? storeId : null;
}

function getPosStoreName() {
  return sessionStorage.getItem('pos_store_name') || 'Store';
}

export default function TerminalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [storeId, setStoreId] = useState<string | null>(getPosStoreId());

  useEffect(() => {
    document.title = 'Terminal';
    const id = getPosStoreId();
    setStoreId(id);
    if (!id) {
      navigate('/pos/select-store', { replace: true });
    }
  }, [navigate]);

  if (!storeId) return null;

  const storeName = getPosStoreName();
  const isTillPage = location.pathname === '/pos/till';

  return (
    <div className="terminal-layout">
      <header className="terminal-header">
        <div className="terminal-header-left">
          <span className="terminal-brand">🏪 {storeName}</span>
        </div>
        <div className="terminal-header-right">
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            onClick={() => {
              sessionStorage.removeItem('pos_store_id');
              sessionStorage.removeItem('pos_store_name');
              sessionStorage.removeItem('pos_token');
              sessionStorage.removeItem('pos_user_id');
              sessionStorage.removeItem('pos_user_name');
              sessionStorage.removeItem('pos_user_role');
              navigate('/pos/select-store', { replace: true });
            }}
          >
            Change Store
          </button>
        </div>
      </header>

      <main className="terminal-content">
        <Outlet />
      </main>

      {!isTillPage && (
        <nav className="terminal-bottom-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`terminal-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="terminal-nav-icon">{item.icon}</span>
              <span className="terminal-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      <ToastContainer />
    </div>
  );
}
