import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// Expect these env vars to be set in Vercel dashboard
const supabaseUrl = process.env.SUPABASE_URL || '';
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
  } = req.body as {
    email: string;
    password: string;
    username: string;
    full_name: string;
    role: string;
    pin: string;
    assigned_store_id?: string | null;
  };

  // Basic validation
  if (!email || !password || !username || !full_name || !role || !pin) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  if (!supabaseUrl || !serviceRole) {
    res.status(500).json({ error: 'Missing Supabase admin credentials' });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create auth user (bypass sign‑up restriction)
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

  // Hash the PIN before storing
  const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

  // Insert profile into public "users" table
  const { error: profileError } = await supabaseAdmin.from('users').insert({
    user_id: authData.user.id,
    email,
    username,
    full_name,
    role,
    pin_hash: pinHash,
    is_active: true,
    assigned_store_id: assigned_store_id || null,
  });

  if (profileError) {
    // Roll back auth user creation on profile failure
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    res.status(400).json({ error: profileError.message });
    return;
  }

  res.status(200).json({ success: true, user_id: authData.user.id });
}
