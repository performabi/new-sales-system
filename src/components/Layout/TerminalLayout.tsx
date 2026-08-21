import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import ToastContainer from '../UI/ToastContainer';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { buildPosUrl, clearPosSession, slugify } from '../../lib/posUrl';
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

function getPosUserName() {
  return sessionStorage.getItem('pos_user_name') || sessionStorage.getItem('pos_user_role') || '';
}

export default function TerminalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ slug?: string; storeRef?: string }>();
  const [storeId, setStoreId] = useState<string | null>(getPosStoreId());

  const handleLogout = async () => {
    await useAuthStore.getState().logout();
  };

  useEffect(() => {
    const slugParam = (params as any)?.slug as string | undefined;
    const storeRefParam = (params as any)?.storeRef as string | undefined;
    const storenameParam = (params as any)?.storename as string | undefined;
    const rawStoreParam = (storenameParam || storeRefParam) as string | undefined;
    const id = getPosStoreId();
    setStoreId(id);
    if (!id) {
      navigate('/pos/select-store', { replace: true });
      return;
    }
    const rawSlug = sessionStorage.getItem('pos_tenant_slug');
    const slug = rawSlug && rawSlug !== 'store' ? rawSlug : null;
    const storeName = sessionStorage.getItem('pos_store_name') || '';
    const expectedStorename = storeName ? slugify(storeName) : (sessionStorage.getItem('pos_store_number') || id.slice(0, 8));
    // Stale slug 'store' in session -> fetch real slug via schema then redirect
    if (!slug) {
      const schema = sessionStorage.getItem('pos_tenant_schema');
      if (schema) {
        fetch(`/api/app/tenant-info?tenant_schema=${encodeURIComponent(schema)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((t) => {
            if (t?.slug) {
              sessionStorage.setItem('pos_tenant_slug', t.slug);
              const suffix = location.pathname.replace(/^\/pos/, '') || '/dashboard';
              const canonicalSuffix = rawStoreParam ? location.pathname.replace(new RegExp(`^/pos/${slugParam || 'store'}/${rawStoreParam || ''}`), '') : suffix;
              navigate(`/pos/${encodeURIComponent(t.slug)}/${encodeURIComponent(expectedStorename)}${canonicalSuffix || '/dashboard'}`, { replace: true });
            }
          })
          .catch(() => {});
        document.title = `Terminal — ${getPosStoreName()}`;
        return;
      }
    }
    // Legacy URL without slug/storename -> redirect to canonical
    if (!slugParam || !rawStoreParam || slugParam === 'store') {
      const suffix = location.pathname.replace(/^\/pos/, '') || '/dashboard';
      if (slug && expectedStorename) {
        navigate(`/pos/${encodeURIComponent(slug)}/${encodeURIComponent(expectedStorename)}${suffix}`, { replace: true });
      } else if (rawStoreParam === 'store' && expectedStorename) {
        // handle stale /pos/store/... URL
        const legacySuffix = location.pathname.replace(new RegExp(`^/pos/${slugParam}/${rawStoreParam}`), '') || '/dashboard';
        if (slug) navigate(`/pos/${encodeURIComponent(slug)}/${encodeURIComponent(expectedStorename)}${legacySuffix}`, { replace: true });
      }
      document.title = `Terminal — ${getPosStoreName()}`;
      return;
    }
    // New URL: validate mismatch -> auto-correct to canonical (token is truth)
    if (slug && slugParam !== slug) {
      const suffix = location.pathname.replace(new RegExp(`^/pos/${slugParam}/${rawStoreParam}`), '');
      navigate(`/pos/${encodeURIComponent(slug)}/${encodeURIComponent(expectedStorename)}${suffix || '/dashboard'}`, { replace: true });
      return;
    }
    const decodedStore = rawStoreParam ? decodeURIComponent(rawStoreParam) : '';
    if (expectedStorename && decodedStore.toLowerCase() !== expectedStorename.toLowerCase() && slugify(decodedStore) !== expectedStorename) {
      const suffix = location.pathname.replace(new RegExp(`^/pos/${slugParam}/${rawStoreParam}`), '');
      navigate(`/pos/${encodeURIComponent(slugParam)}/${encodeURIComponent(expectedStorename)}${suffix || '/dashboard'}`, { replace: true });
      return;
    }
    document.title = `Terminal — ${getPosStoreName()}${slug ? ` · ${slug}` : ''}${expectedStorename ? ` · ${expectedStorename}` : ''}`;
  }, [navigate, location.pathname, (params as any)?.slug, (params as any)?.storeRef, (params as any)?.storename]);

  useEffect(() => {
    const el = document.documentElement;
    const stored = useThemeStore.getState().theme;
    el.classList.remove('theme-light', 'theme-dark');
    el.classList.add('theme-dark');
    return () => {
      el.classList.remove('theme-light', 'theme-dark');
      el.classList.add(`theme-${stored}`);
    };
  }, []);

  if (!storeId) return null;

  const storeName = getPosStoreName();
  const rawSlug = sessionStorage.getItem('pos_tenant_slug');
  const slug = rawSlug && rawSlug !== 'store' ? rawSlug : ((params as any)?.slug && (params as any)?.slug !== 'store' ? (params as any)?.slug : '');
  const storeRefDisplay = storeName !== 'Store' ? slugify(storeName) : (sessionStorage.getItem('pos_store_number') || storeId.slice(0, 8));
  const isTillPage = location.pathname.endsWith('/till');

  const posNavPath = (path: string) => {
    const suffix = path.replace(/^\/pos/, '') || '/dashboard';
    const rawS = sessionStorage.getItem('pos_tenant_slug');
    const s = rawS && rawS !== 'store' ? rawS : ((params as any)?.slug && (params as any)?.slug !== 'store' ? (params as any)?.slug : '');
    const r = storeName !== 'Store' ? slugify(storeName) : (sessionStorage.getItem('pos_store_number') || storeId.slice(0, 8));
    if (!s || !r || s === 'store') return path;
    return buildPosUrl(s, r, suffix);
  };

  const isActive = (path: string) => location.pathname === path || location.pathname === posNavPath(path);

  return (
    <div className="terminal-layout">
      <header className="terminal-header">
        <div className="terminal-header-left">
          <span className="terminal-brand">🏪 {storeName}</span>
          {slug && <span style={{ marginLeft: '8px', fontSize: '0.7rem', opacity: 0.7 }}>{slug} · {storeRefDisplay}</span>}
        </div>
        <div className="terminal-header-right">
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            onClick={() => {
              clearPosSession();
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
              className={`terminal-nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(posNavPath(item.path))}
            >
              <span className="terminal-nav-icon">{item.icon}</span>
              <span className="terminal-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      {!isTillPage && (
        <footer className="terminal-footer">
          {getPosUserName() && <span className="terminal-footer-user">{getPosUserName()}</span>}
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </footer>
      )}

      <ToastContainer />
    </div>
  );
}
