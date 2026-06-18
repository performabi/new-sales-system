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

          // Load environment variables manually since this runs on the server side
          const env = loadEnv(server.config.mode, process.cwd(), '');
          
          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';

          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }

          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          // 2. Create Auth User using Admin API
          // This bypasses the "Allow new users to sign up" toggle in Supabase
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm so they don't need to click a link
          });

          if (authError) {
            return res.status(400).json({ error: authError.message });
          }
          if (!authData.user) {
            return res.status(400).json({ error: 'Failed to create auth user.' });
          }

          // 3. Hash the PIN
          const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

          // 4. Insert into 'users' table
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

          // If profile fails, rollback the auth user creation
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

      // Admin route to update users
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
        
        // 1. Update auth.users (email and password if provided)
        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (password) authUpdates.password = password;
        
        // 2. Handle PIN if provided: hash and include in public.users update
        const pinUpdate = pin ? { pin_hash: crypto.createHash('sha256').update(pin).digest('hex') } : {};
        
        if (Object.keys(authUpdates).length > 0) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
          if (authError) return res.status(400).json({ error: authError.message });
        }
        
        // 3. Update public.users table
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
        try {
          const { id } = req.params;
          const { email, password, username, full_name, role, is_active, assigned_store_id } = req.body;
          const env = loadEnv(server.config.mode, process.cwd(), '');
          
          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';

          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }

          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          // 1. Update auth.users (email and password if provided)
          const authUpdates: any = {};
          if (email) authUpdates.email = email;
          if (password) authUpdates.password = password;
+          // 2. Handle PIN if provided: hash and update pin_hash in public.users table
+          const pin = req.body.pin as string | undefined;
+          const pinUpdate = pin ? { pin_hash: crypto.createHash('sha256').update(pin).digest('hex') } : {};
 
          if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
            if (authError) return res.status(400).json({ error: authError.message });
          }
 
          // 3. Update public.users table
-          const { error: profileError } = await supabaseAdmin.from('users').update({
-            email,
-            username,
-            full_name,
-            role,
-            is_active,
-            assigned_store_id: assigned_store_id || null,
-          }).eq('user_id', id);
+          const { error: profileError } = await supabaseAdmin.from('users').update({
+            email,
+            username,
+            full_name,
+            role,
+            is_active,
+            assigned_store_id: assigned_store_id || null,
+            ...pinUpdate,
+          }).eq('user_id', id);
 
          if (profileError) return res.status(400).json({ error: profileError.message });
 
          return res.json({ success: true });
*** End Patch
          const authUpdates: any = {};
          if (email) authUpdates.email = email;
          if (password) authUpdates.password = password;

          if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
            if (authError) return res.status(400).json({ error: authError.message });
          }

          // 2. Update public.users table
          const { error: profileError } = await supabaseAdmin.from('users').update({
            email,
            username,
            full_name,
            role,
            is_active,
            assigned_store_id: assigned_store_id || null,
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

      // Admin route to reset password
    app.put('/api/users/:id/reset-password', async (req, res) => {
      try {
        const { id } = req.params;
        const { newPassword } = req.body; // optional custom password
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
        
        const { error: profileError } = await supabaseAdmin.from('users').update({ requires_password_change: true }).eq('user_id', id);
        if (profileError) return res.status(400).json({ error: profileError.message });
        
        return res.json({ success: true, passwordSet: !!newPassword });
      } catch (err) {
        console.error('Server error resetting password:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
      app.put('/api/users/:id/reset-password', async (req, res) => {
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

          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { password: 'Sales12345' });
          if (authError) return res.status(400).json({ error: authError.message });

          const { error: profileError } = await supabaseAdmin.from('users').update({ requires_password_change: true }).eq('user_id', id);
          if (profileError) return res.status(400).json({ error: profileError.message });

          return res.json({ success: true });
        } catch (err) {
          console.error('Server error resetting password:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // Mount Express app onto Vite's dev server
      server.middlewares.use(app);
    },
  };
}
