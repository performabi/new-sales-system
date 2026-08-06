import { useAuthStore } from '../store/authStore';

export function apiFetch(path: string, options?: RequestInit) {
  const auth = useAuthStore.getState();
  const schema = auth.user?.user_metadata?.tenant_schema as string | undefined;
  const separator = path.includes('?') ? '&' : '?';
  const url = schema ? `${path}${separator}tenant_schema=${encodeURIComponent(schema)}` : path;
  return fetch(url, options);
}
