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

export function apiFetch(path: string, options?: RequestInit) {
  const auth = useAuthStore.getState();
  const schema = auth.activeTenantSchema || (auth.user?.user_metadata?.tenant_schema as string | undefined);
  const separator = path.includes('?') ? '&' : '?';
  const url = schema ? `${path}${separator}tenant_schema=${encodeURIComponent(schema)}` : path;
  const headers = authHeaders(options);
  return fetch(url, { ...options, headers });
}
