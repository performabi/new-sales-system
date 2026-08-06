import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRole = process.env.SERVICE_ROLE || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const {
    email,
    password,
    username,
    full_name,
    role,
    pin,
    assigned_store_id,
    created_by,
    tenant_schema,
  } = req.body as {
    email: string;
    password: string;
    username: string;
    full_name: string;
    role: string;
    pin: string;
    assigned_store_id?: string | null;
    created_by?: string | null;
    tenant_schema?: string;
  };

  if (!email || !password || !username || !full_name || !role || !pin) {
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
  if (!supabaseUrl || !serviceRole) {
    res.status(500).json({ error: 'Missing Supabase admin credentials' });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: tenant_schema },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) {
    res.status(400).json({ error: authError.message });
    return;
  }
  if (!authData?.user) {
    res.status(400).json({ error: 'Failed to create auth user' });
    return;
  }

  const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    user_id: authData.user.id,
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
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    res.status(400).json({ error: profileError.message });
    return;
  }

  res.status(200).json({ success: true, user_id: authData.user.id });
}
