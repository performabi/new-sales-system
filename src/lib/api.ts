import { useAuthStore } from '../store/authStore';

function authHeaders(options?: RequestInit): Headers {
  const headers = new Headers(options?.headers);
  const state = useAuthStore.getState();
  const token = state.session?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const posToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pos_token') : null;
  if (posToken) headers.set('X-POS-Token', posToken);
  return headers;
}

// Endpoints that legitimately return 401 (wrong PIN, invalid input, etc.)
// must NOT trigger the global session-expiry sign-out.
function isPublicApiPath(path: string, method?: string) {
  if (path.startsWith('/api/pos/login') || path.startsWith('/api/pos/pin-login') || path.startsWith('/api/pos/admin-login')) return true;
  if (path.startsWith('/api/app/tenant-info')) return true;
  if (path.startsWith('/api/public/tenants')) return true;
  if (path.startsWith('/api/loyalty-cards/create')) return true;
  if (path.startsWith('/api/stores') && (!method || method.toUpperCase() === 'GET')) return true;
  return false;
}

export async function apiFetch(path: string, options?: RequestInit) {
  const auth = useAuthStore.getState();
  const schema = auth.activeTenantSchema || (auth.user?.user_metadata?.tenant_schema as string | undefined);
  const separator = path.includes('?') ? '&' : '?';
  const url = schema ? `${path}${separator}tenant_schema=${encodeURIComponent(schema)}` : path;
  const headers = authHeaders(options);
  const hadBearer = !!headers.get('Authorization');
  const res = await fetch(url, { ...options, headers });
  // Stale/expired browser session: sign out cleanly instead of showing
  // "Unauthorized" errors on every page.
  if (res.status === 401 && hadBearer && !isPublicApiPath(path, options?.method)) {
    useAuthStore.getState().signOut();
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  }
  return res;
}
