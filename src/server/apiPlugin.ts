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

      // ---- Users: create ----
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
          });

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

      // ---- Users: update ----
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

      // ---- Users: fetch all (with store name) ----
      app.get('/api/users', async (_req, res) => {
        try {
          const env = loadEnv(server.config.mode, process.cwd(), '');
          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';
          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }
          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data, error } = await supabaseAdmin
            .from('users')
            .select('*, stores!users_assigned_store_id_fkey(name)')
            .order('full_name');
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Server error fetching users:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Users: delete ----
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

      // ---- PLU Categories: create ----
      app.post('/api/plu_categories/create', async (req, res) => {
        try {
          const { name, created_by } = req.body;
          const env = loadEnv(server.config.mode, process.cwd(), '');
          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';
          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }
          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data, error } = await supabaseAdmin
            .from('plu_categories')
            .insert({ name, created_by })
            .select()
            .single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, category: data });
        } catch (err) {
          console.error('Server error creating PLU category:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU Categories: update ----
      app.put('/api/plu_categories/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const { name } = req.body;
          const env = loadEnv(server.config.mode, process.cwd(), '');
          const supabaseUrl = env.VITE_SUPABASE_URL || '';
          const serviceRole = env.SERVICE_ROLE || '';
          if (!supabaseUrl || !serviceRole) {
            return res.status(500).json({ error: 'Missing Supabase admin credentials on server.' });
          }
          const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { error } = await supabaseAdmin
            .from('plu_categories')
            .update({ name })
            .eq('category_id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error updating PLU category:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU Categories: delete ----
      app.delete('/api/plu_categories/:id', async (req, res) => {
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
          const { count } = await supabaseAdmin
            .from('plu')
            .select('plu_id', { count: 'exact', head: true })
            .eq('category_id', id);
          if ((count ?? 0) > 0) {
            return res.status(400).json({ error: 'Cannot delete — category is assigned to PLUs.' });
          }
          const { error } = await supabaseAdmin
            .from('plu_categories')
            .delete()
            .eq('category_id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error deleting PLU category:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Logbook: create entry ----
      app.post('/api/logbook/create', async (req, res) => {
        try {
          const { entity, entityLabel, field, oldValue, newValue, username } = req.body;
          const env = loadEnv(server.config.mode, process.cwd(), '');
          const supabaseAdmin = createClient(env.VITE_SUPABASE_URL || '', env.SERVICE_ROLE || '', {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { error } = await supabaseAdmin.from('logbook').insert({
            entity,
            entity_label: entityLabel,
            field,
            old_value: oldValue,
            new_value: newValue,
            username,
          });
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error creating logbook entry:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Logbook: fetch all entries (newest first) ----
      app.get('/api/logbook', async (_req, res) => {
        try {
          const env = loadEnv(server.config.mode, process.cwd(), '');
          const supabaseAdmin = createClient(env.VITE_SUPABASE_URL || '', env.SERVICE_ROLE || '', {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data, error } = await supabaseAdmin
            .from('logbook')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1000);
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Server error fetching logbook:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // Mount Express app onto Vite's dev server
      server.middlewares.use(app);
    },
  };
}
