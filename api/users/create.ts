import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hashPin, resolveIdentity, identityHasSchema } from '../../src/server/apiAuth.ts';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRole = process.env.SERVICE_ROLE || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const env = { supabaseUrl, serviceRole, anonKey: '' };
  const identity = await resolveIdentity(req, env);
  if (!identity) {
    res.status(401).json({ error: 'Unauthorized — missing or invalid session' });
    return;
  }

  const {
    email,
    username,
    full_name,
    role,
    pin,
    assigned_store_id,
    created_by,
    tenant_schema,
  } = req.body as {
    email: string;
    username: string;
    full_name: string;
    role: string;
    pin: string;
    assigned_store_id?: string | null;
    created_by?: string | null;
    tenant_schema?: string;
  };

  if (!email || !username || !full_name || !role || !pin) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  if (!/^\d{4,8}$/.test(String(pin))) {
    res.status(400).json({ error: 'PIN must be 4-8 digits' });
    return;
  }
  if (!tenant_schema) {
    res.status(400).json({ error: 'tenant_schema is required' });
    return;
  }
  if (!identityHasSchema(identity, tenant_schema)) {
    res.status(403).json({ error: 'Not a member of this tenant' });
    return;
  }
  if (!supabaseUrl || !serviceRole) {
    res.status(500).json({ error: 'Missing Supabase admin credentials' });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: tenant_schema },
  });

  const supabaseAuth = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listData, error: listError } = await supabaseAuth.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    res.status(500).json({ error: listError.message });
    return;
  }
  const existing = (listData?.users || []).find((u) => u.email?.toLowerCase() === String(email).toLowerCase());

  let authUserId: string;
  let linked = false;
  let invited = false;
  const inviteOptions: {
    data: Record<string, unknown>;
    redirectTo: string | undefined;
  } = {
    data: { tenant_schemas: [tenant_schema], tenant_schema, full_name: full_name || '' },
    redirectTo: process.env.APP_URL || req.headers.origin || undefined,
  };

  if (existing) {
    linked = true;
    authUserId = existing.id;
    const existingMeta = existing.user_metadata || {};
    const currentSchemas = Array.isArray(existingMeta.tenant_schemas)
      ? (existingMeta.tenant_schemas as string[])
      : existingMeta.tenant_schema
        ? [existingMeta.tenant_schema]
        : [];
    const mergedSchemas = [...new Set([...currentSchemas, tenant_schema])];

    const { error: metaError } = await supabaseAuth.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        ...existingMeta,
        tenant_schemas: mergedSchemas,
        tenant_schema: existingMeta.tenant_schema || tenant_schema,
      },
    });
    if (metaError) {
      res.status(400).json({ error: metaError.message });
      return;
    }
    if (!existing.confirmed_at) {
      const { error: inviteError } = await supabaseAuth.auth.admin.inviteUserByEmail(email, inviteOptions);
      if (inviteError) {
        res.status(400).json({ error: inviteError.message });
        return;
      }
      invited = true;
    }
  } else {
    const { data: inviteData, error: inviteError } = await supabaseAuth.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (inviteError) {
      res.status(400).json({ error: inviteError.message });
      return;
    }
    if (!inviteData?.user) {
      res.status(400).json({ error: 'Failed to create auth user' });
      return;
    }
    authUserId = inviteData.user.id;
    invited = true;
  }

  const { data: existingRow } = await supabaseAdmin.from('users').select('user_id').eq('user_id', authUserId).maybeSingle();
  if (existingRow) {
    res.status(409).json({ error: 'User is already a member of this tenant' });
    return;
  }

  const pinHash = hashPin(pin);

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    user_id: authUserId,
    email,
    username,
    full_name,
    role,
    pin_hash: pinHash,
    is_active: true,
    assigned_store_id: assigned_store_id || null,
    created_by: created_by || null,
  });

  if (profileError) {
    if (!linked) {
      await supabaseAuth.auth.admin.deleteUser(authUserId);
    }
    res.status(400).json({ error: profileError.message });
    return;
  }

  res.status(200).json({ success: true, user_id: authUserId, linked, invited });
}
