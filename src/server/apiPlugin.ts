import { loadEnv, type Plugin } from 'vite';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json());

      // Admin route to create users (bypasses public signup restrictions)
      app.post('/api/users/create', async (req, res) => {
        try {
          const { email, password, username, full_name, role, pin, assigned_store_id } = req.body;

          const env = loadEnv(server.config.mode, process.cwd(), '');
          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';

          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }

          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          // Create Auth User using Admin API (bypasses "Allow new users to sign up" toggle)
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });

          if (authError) {
            return res.status(400).json({ error: authError.message });
          }
          if (!authData.user) {
            return res.status(400).json({ error: 'Failed to create auth user.' });
          }

          // Hash the PIN
          const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

          // Insert into 'users' table
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

          // If profile insert fails, rollback auth user creation
          if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: profileError.message });
          }

          return res.json({ success: true, user_id: authData.user.id });
        } catch (err) {
          console.error('Server error creating user:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // Admin route to reset password — MUST be registered BEFORE the generic PUT /api/users/:id
      // to prevent Express matching "reset-password" as the :id param
      app.put('/api/users/:id/reset-password', async (req, res) => {
        try {
          const { id } = req.params;
          const newPassword: string | undefined = (req.body || {}).newPassword;
          const env = loadEnv(server.config.mode, process.cwd(), '');

          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';

          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }

          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

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
      });

      // Admin route to update users (generic — registered AFTER the specific reset-password route)
      app.put('/api/users/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const { email, password, username, full_name, role, is_active, assigned_store_id, pin } = req.body;
          const env = loadEnv(server.config.mode, process.cwd(), '');
          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';

          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }

          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const authUpdates: any = {};
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
      });

      // Admin route to delete users
      app.delete('/api/users/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const env = loadEnv(server.config.mode, process.cwd(), '');

          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';

          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }

          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
          if (error) {
            return res.status(400).json({ error: error.message });
          }

          return res.json({ success: true });
        } catch (err) {
          console.error('Server error deleting user:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // Mount Express app onto Vite's dev server
      server.middlewares.use(app);
    },
  };
}
