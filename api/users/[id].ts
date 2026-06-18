import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query as { id: string };

  if (!id) return res.status(400).json({ error: 'Missing user id' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const serviceRole = process.env.SERVICE_ROLE || '';

  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // PUT /api/users/[id]/reset-password
  if (req.method === 'PUT' && req.url?.includes('/reset-password')) {
    try {
      const newPassword: string | undefined = (req.body || {}).newPassword;
      const password = newPassword || 'Sales12345';

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (authError) return res.status(400).json({ error: authError.message });

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .update({ requires_password_change: true })
        .eq('user_id', id);
      if (profileError) return res.status(400).json({ error: profileError.message });

      return res.json({ success: true, passwordSet: !!newPassword });
    } catch (err) {
      console.error('Server error resetting password:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /api/users/[id] — update user
  if (req.method === 'PUT') {
    try {
      const { email, password, username, full_name, role, is_active, assigned_store_id, pin } = req.body || {};

      const authUpdates: Record<string, string> = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
        if (authError) return res.status(400).json({ error: authError.message });
      }

      const pinUpdate = pin ? { pin_hash: crypto.createHash('sha256').update(pin).digest('hex') } : {};

      const { error: profileError } = await supabaseAdmin.from('users').update({
        email,
        username,
        full_name,
        role,
        is_active,
        assigned_store_id: assigned_store_id || null,
        ...pinUpdate,
      }).eq('user_id', id);
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
