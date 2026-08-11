// Shared server-side auth helpers (used by both the Vite dev API and Vercel functions)
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface AuthEnv {
  supabaseUrl: string;
  serviceRole: string;
  anonKey: string;
}

export function getAdminClient(env: AuthEnv, schema?: string) {
  if (!env.supabaseUrl || !env.serviceRole) {
    throw new Error('Missing Supabase admin credentials on server.');
  }
  const opts: any = { auth: { autoRefreshToken: false, persistSession: false } };
  if (schema) opts.db = { schema };
  return createClient(env.supabaseUrl, env.serviceRole, opts);
}

// ---------------- PIN hashing (salted SHA-256 with legacy migration) ----------------

const PIN_ITERATIONS = 1000;

function slowSha256(input: string): Buffer {
  let buf = Buffer.from(input, 'utf8');
  for (let i = 0; i < PIN_ITERATIONS; i++) {
    buf = crypto.createHash('sha256').update(buf).digest();
  }
  return buf;
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = slowSha256(`${salt}:${pin}`).toString('hex');
  return `sha256$${salt}$${digest}`;
}

export function verifyPin(
  pin: string,
  stored?: string | null,
): { ok: boolean; upgradedHash?: string } {
  if (!stored) return { ok: false };

  if (stored.includes('$')) {
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== 'sha256') return { ok: false };
    const [, salt, digest] = parts;
    const check = slowSha256(`${salt}:${pin}`).toString('hex');
    return { ok: crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(digest, 'hex')) };
  }

  // Legacy unsalted single SHA-256 — verify then transparently upgrade
  const legacy = crypto.createHash('sha256').update(pin).digest('hex');
  if (crypto.timingSafeEqual(Buffer.from(legacy, 'hex'), Buffer.from(stored, 'hex'))) {
    return { ok: true, upgradedHash: hashPin(pin) };
  }
  return { ok: false };
}

// ---------------- POS terminal tokens (HMAC-signed, stateless) ----------------

function posSecret(env: AuthEnv): string {
  return `pos:${env.serviceRole}:${env.supabaseUrl}`;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface PosTokenPayload {
  v: 1;
  uid: string;
  schema: string;
  store_id?: string;
  role: string;
  exp: number;
}

export function signPosToken(env: AuthEnv, payload: Omit<PosTokenPayload, 'v' | 'exp'>): string {
  const body: PosTokenPayload = { v: 1, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, ...payload };
  const data = base64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', posSecret(env)).update(data).digest('hex');
  return `${data}.${sig}`;
}

export function verifyPosToken(env: AuthEnv, token: string): PosTokenPayload | null {
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', posSecret(env)).update(data).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as PosTokenPayload;
    if (payload.v !== 1 || !payload.uid || !payload.schema) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------- Request identity ----------------

export type Identity =
  | { kind: 'jwt'; user: any }
  | { kind: 'pos'; payload: PosTokenPayload };

export function getBearerToken(req: any): string | null {
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export function getPosToken(req: any): string | null {
  const header = req.headers?.['x-pos-token'];
  if (typeof header !== 'string') return null;
  return header.trim() || null;
}

export async function resolveIdentity(req: any, env: AuthEnv): Promise<Identity | null> {
  const jwt = getBearerToken(req);
  if (jwt) {
    const client = getAdminClient(env, 'public');
    const { data, error } = await client.auth.getUser(jwt);
    if (!error && data?.user) return { kind: 'jwt', user: data.user };
  }
  const pos = getPosToken(req);
  if (pos) {
    const payload = verifyPosToken(env, pos);
    if (payload) return { kind: 'pos', payload };
  }
  return null;
}

export function tenantSchemasOf(user: any): string[] {
  const meta = user?.user_metadata || {};
  if (Array.isArray(meta.tenant_schemas) && meta.tenant_schemas.length > 0) {
    return meta.tenant_schemas as string[];
  }
  if (meta.tenant_schema) return [meta.tenant_schema as string];
  return [];
}

export function identityHasSchema(identity: Identity, schema: string): boolean {
  if (identity.kind === 'pos') {
    return identity.payload.role === 'super_admin' || identity.payload.schema === schema;
  }
  return tenantSchemasOf(identity.user).includes(schema);
}

export function defaultSchemaFor(identity: Identity): string | undefined {
  if (identity.kind === 'pos') return identity.payload.schema;
  const schemas = tenantSchemasOf(identity.user);
  return schemas.length === 1 ? schemas[0] : undefined;
}

export async function isSuperAdminUser(env: AuthEnv, userId: string): Promise<boolean> {
  const client = getAdminClient(env, 'public');
  const { data } = await client
    .from('super_users')
    .select('role')
    .eq('super_user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return !!data && (data.role === 'super_admin' || data.role === 'support');
}

// ---------------- Public path allowlist ----------------

export function isPublicPath(method: string, path: string): boolean {
  if (path === 'pos/login') return true;
  if (path === 'pos/admin-login') return true;
  if (path === 'app/tenant-info') return true;
  if (path === 'public/tenants') return true;
  if (path === 'loyalty-cards/create') return true;
  // Store listing for the public loyalty-registration flow (slug-based only)
  if (path === 'stores' && method === 'GET') return true;
  return false;
}

// ---------------- POS login rate limiting (DB-backed, serverless-safe) ----------------

export async function isPosLoginThrottled(env: AuthEnv, identifier: string): Promise<boolean> {
  try {
    const client = getAdminClient(env, 'public');
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await client
      .from('pos_login_attempts')
      .select('attempt_id', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('success', false)
      .gte('attempted_at', since);
    return (count ?? 0) >= 10;
  } catch {
    // fail open: never block logins because of throttling infrastructure
    return false;
  }
}

export async function recordPosAttempt(env: AuthEnv, identifier: string, success: boolean, ip?: string): Promise<void> {
  try {
    const client = getAdminClient(env, 'public');
    await client.from('pos_login_attempts').insert({ identifier, success, ip: ip || null });
  } catch {
    // never fail the login flow because of attempt logging
  }
}

export function requestIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}
