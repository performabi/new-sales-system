export function getPosTenantSlug(): string | null {
  return sessionStorage.getItem('pos_tenant_slug');
}

export function getPosStoreNumber(): string | null {
  return sessionStorage.getItem('pos_store_number');
}

export function getPosStoreId(): string | null {
  const storeId = sessionStorage.getItem('pos_store_id');
  const token = sessionStorage.getItem('pos_token');
  return storeId && token ? storeId : null;
}

export function getPosStoreRef(): string {
  const num = getPosStoreNumber();
  const id = getPosStoreId();
  if (num) return num;
  if (id) return id.slice(0, 8);
  return 'store';
}

export function buildPosUrl(slug: string | null, storeRef: string | null, suffix: string): string {
  const s = slug || getPosTenantSlug() || 'store';
  const r = storeRef || getPosStoreRef();
  const base = `/pos/${encodeURIComponent(s)}/${encodeURIComponent(r)}`;
  if (!suffix || suffix === '/') return `${base}/dashboard`;
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export function clearPosSession() {
  sessionStorage.removeItem('pos_store_id');
  sessionStorage.removeItem('pos_store_name');
  sessionStorage.removeItem('pos_store_number');
  sessionStorage.removeItem('pos_tenant_slug');
  sessionStorage.removeItem('pos_tenant_schema');
  sessionStorage.removeItem('pos_token');
  sessionStorage.removeItem('pos_user_id');
  sessionStorage.removeItem('pos_user_name');
  sessionStorage.removeItem('pos_user_role');
}
