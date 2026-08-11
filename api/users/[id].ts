import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { hashPin, resolveIdentity, identityHasSchema, defaultSchemaFor } from '../../src/server/apiAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query as { id: string };

  if (!id) return res.status(400).json({ error: 'Missing user id' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const serviceRole = process.env.SERVICE_ROLE || '';

  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
  }

  const env = { supabaseUrl, serviceRole, anonKey: '' };
  const identity = await resolveIdentity(req, env);
  if (!identity) {
    return res.status(401).json({ error: 'Unauthorized — missing or invalid session' });
  }

  let tenant_schema = (req.body?.tenant_schema as string) || (req.query.tenant_schema as string) || '';
  if (!tenant_schema) {
    tenant_schema = defaultSchemaFor(identity) || '';
  }
  if (!tenant_schema) {
    return res.status(400).json({ error: 'tenant_schema is required' });
  }
  if (!identityHasSchema(identity, tenant_schema)) {
    return res.status(403).json({ error: 'Not a member of this tenant' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(tenant_schema ? { db: { schema: tenant_schema } } : {}),
  });

  // PUT /api/users/[id]/reset-password
  if (req.method === 'PUT' && req.url?.includes('/reset-password')) {
    try {
      const newPassword: string | undefined = (req.body || {}).newPassword;
      if (!newPassword || String(newPassword).length < 8) {
        return res.status(400).json({ error: 'newPassword is required (min 8 characters)' });
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { password: String(newPassword) });
      if (authError) return res.status(400).json({ error: authError.message });

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .update({ requires_password_change: true })
        .eq('user_id', id);
      if (profileError) return res.status(400).json({ error: profileError.message });

      return res.json({ success: true });
    } catch (err) {
      console.error('Server error resetting password:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /api/users/[id]/resend-invite
  if (req.method === 'PUT' && req.url?.includes('/resend-invite')) {
    try {
      const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(id);
      if (getUserError || !authUser?.user) return res.status(404).json({ error: 'User not found' });

      const email = authUser.user.email;
      if (!email) return res.status(400).json({ error: 'User has no email' });

      if (!authUser.user.confirmed_at) {
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { ...(authUser.user.user_metadata || {}) },
          redirectTo: process.env.APP_URL || req.headers.origin || undefined,
        });
        if (inviteError) return res.status(400).json({ error: inviteError.message });
        return res.json({ success: true, method: 'invite' });
      }

      const anon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
      const { error: resetError } = await anon.auth.resetPasswordForEmail(email, {
        redirectTo: process.env.APP_URL || req.headers.origin || undefined,
      });
      if (resetError) return res.status(400).json({ error: resetError.message });
      return res.json({ success: true, method: 'recovery' });
    } catch (err) {
      console.error('Server error resending invite:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /api/users/[id] — update user
  if (req.method === 'PUT') {
    try {
      const { email, password, username, full_name, role, is_active, assigned_store_id, pin } = req.body || {};

      if (pin && !/^\d{4,8}$/.test(String(pin))) {
        return res.status(400).json({ error: 'PIN must be 4-8 digits' });
      }

      const authUpdates: Record<string, string> = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
        if (authError) return res.status(400).json({ error: authError.message });
      }

      const pinUpdate = pin ? { pin_hash: hashPin(String(pin)) } : {};
      const profileUpdate: Record<string, unknown> = {
        email,
        username,
        full_name,
        role,
        is_active,
        ...pinUpdate,
      };
      if ('assigned_store_id' in (req.body || {})) profileUpdate.assigned_store_id = assigned_store_id || null;

      const { error: profileError } = await supabaseAdmin.from('users').update(profileUpdate).eq('user_id', id);
      if (profileError) return res.status(400).json({ error: profileError.message });

      return res.json({ success: true });
    } catch (err) {
      console.error('Server error updating user:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE /api/users/[id]
  if (req.method === 'DELETE') {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    } catch (err) {
      console.error('Server error deleting user:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
