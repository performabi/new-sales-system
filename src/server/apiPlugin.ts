import { loadEnv, type Plugin } from 'vite';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

let currentSchema: string | undefined;

function getSupabaseAdmin(server: any, schema?: string) {
  const env = loadEnv(server.config.mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || '';
  const serviceRole = env.SERVICE_ROLE || '';
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing Supabase admin credentials on server.');
  }
  const opts: any = {
    auth: { autoRefreshToken: false, persistSession: false },
  };
  if (schema) opts.db = { schema };
  else if (currentSchema) opts.db = { schema: currentSchema };
  return createClient(supabaseUrl, serviceRole, opts);
}

export function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json());
      app.use((req, _, next) => {
        currentSchema = (req.query?.tenant_schema as string) || req.body?.tenant_schema;
        next();
      });

      // ---- Users: create ----
      app.post('/api/users/create', async (req, res) => {
        try {
          const { email, password, username, full_name, role, pin, assigned_store_id, created_by, tenant_schema } = req.body;
          if (!/^\d{4,8}$/.test(String(pin || ''))) {
            return res.status(400).json({ error: 'PIN must be 4-8 digits' });
          }
          if (!tenant_schema) {
            return res.status(400).json({ error: 'tenant_schema is required' });
          }
          const supabaseAdmin = getSupabaseAdmin(server, tenant_schema);

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
            created_by: created_by || null,
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
          const { email, password, username, full_name, role, is_active, assigned_store_id, pin, tenant_schema } = req.body;
          if (pin && !/^\d{4,8}$/.test(String(pin))) {
            return res.status(400).json({ error: 'PIN must be 4-8 digits' });
          }
          if (!tenant_schema) {
            return res.status(400).json({ error: 'tenant_schema is required' });
          }
          const supabaseAdmin = getSupabaseAdmin(server, tenant_schema);

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
      app.get('/api/users', async (req, res) => {
        try {
          const tenant_schema = req.query.tenant_schema as string;
          if (!tenant_schema) {
            return res.status(400).json({ error: 'tenant_schema query param required' });
          }
          const supabaseAdmin = getSupabaseAdmin(server, tenant_schema);
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
          const supabaseAdmin = getSupabaseAdmin(server);

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

      // ---- Users: reset password ----
      app.put('/api/users/:id/reset-password', async (req, res) => {
        try {
          const { id } = req.params;
          const { newPassword, tenant_schema } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          const password = newPassword || 'Sales12345';
          const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
          if (error) return res.status(400).json({ error: error.message });

          if (tenant_schema) {
            const tenantAdmin = getSupabaseAdmin(server, tenant_schema);
            await tenantAdmin.from('users').update({ requires_password_change: true }).eq('user_id', id);
          }

          return res.json({ success: true });
        } catch (err) {
          console.error('Server error resetting password:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU Scheduled Changes: create ----
      app.post('/api/plu_scheduled_changes', async (req, res) => {
        try {
          const { plu_id, payload, scheduled_at, created_by } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('plu_scheduled_changes')
            .insert({ plu_id, payload, scheduled_at, created_by })
            .select()
            .single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, scheduled_change: data });
        } catch (err) {
          console.error('Server error scheduling PLU change:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU Scheduled Changes: fetch due ----
      app.get('/api/plu_scheduled_changes/due', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('plu_scheduled_changes')
            .select('*')
            .lte('scheduled_at', new Date().toISOString())
            .is('applied_at', null);
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Server error fetching due scheduled changes:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU Scheduled Changes: mark applied ----
      app.put('/api/plu_scheduled_changes/:id/applied', async (req, res) => {
        try {
          const { id } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { error } = await supabaseAdmin
            .from('plu_scheduled_changes')
            .update({ applied_at: new Date().toISOString() })
            .eq('id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error marking scheduled change applied:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU Categories: create ----
      app.post('/api/plu_categories/create', async (req, res) => {
        try {
          const { name, created_by } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
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
          const supabaseAdmin = getSupabaseAdmin(server);
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
          const supabaseAdmin = getSupabaseAdmin(server);
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
      // ---- Item Sizing ----
      app.get('/api/item-sizing', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('item_sizing')
            .select('*')
            .order('unit_type', { ascending: true })
            .order('packs_per_case', { ascending: true });
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Server error fetching item sizing:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      app.post('/api/item-sizing/create', async (req, res) => {
        try {
          const { unit_type, units_per_pack, packs_per_case } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          const payload: Record<string, unknown> = { unit_type, packs_per_case };
          if (unit_type === 'each') {
            payload.units_per_pack = Math.floor(Number(units_per_pack));
            payload.packs_per_case = Math.floor(Number(packs_per_case));
          } else {
            payload.units_per_pack = Number(units_per_pack);
            payload.packs_per_case = Number(packs_per_case);
          }
          const { data, error } = await supabaseAdmin
            .from('item_sizing')
            .insert(payload)
            .select()
            .single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, item: data });
        } catch (err) {
          console.error('Server error creating item sizing:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      app.put('/api/item-sizing/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const { unit_type, units_per_pack, packs_per_case } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          const payload: Record<string, unknown> = { unit_type, packs_per_case };
          if (unit_type === 'each') {
            payload.units_per_pack = Math.floor(Number(units_per_pack));
            payload.packs_per_case = Math.floor(Number(packs_per_case));
          } else {
            payload.units_per_pack = Number(units_per_pack);
            payload.packs_per_case = Number(packs_per_case);
          }
          const { error } = await supabaseAdmin
            .from('item_sizing')
            .update(payload)
            .eq('id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error updating item sizing:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      app.delete('/api/item-sizing/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { error } = await supabaseAdmin
            .from('item_sizing')
            .delete()
            .eq('id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error deleting item sizing:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU: create ----
      app.post('/api/plu/create', async (req, res) => {
        try {
          const { name, plu_number, headoffice_price, category_id, ...rest } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { count } = await supabaseAdmin
            .from('plu')
            .select('plu_id', { count: 'exact', head: true })
            .eq('plu_number', plu_number);
          if ((count ?? 0) > 0) {
            return res.status(400).json({ error: `PLU number "${plu_number}" already exists.` });
          }
          const { data: inserted, error } = await supabaseAdmin
            .from('plu')
            .insert({ name, plu_number, headoffice_price, category_id, ...rest })
            .select('*, plu_categories(name)')
            .single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, plu: inserted });
        } catch (err) {
          console.error('Server error creating PLU:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU: update ----
      app.put('/api/plu/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const data = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          if (data.plu_number) {
            const { count } = await supabaseAdmin
              .from('plu')
              .select('plu_id', { count: 'exact', head: true })
              .eq('plu_number', data.plu_number)
              .neq('plu_id', id);
            if ((count ?? 0) > 0) {
              return res.status(400).json({ error: `PLU number "${data.plu_number}" already exists.` });
            }
          }
          const { data: oldPlu } = await supabaseAdmin.from('plu').select('*').eq('plu_id', id).single();
          const username = data.username || 'system';
          const { username: _unused_plu, ...updateData } = data;
          const { error } = await supabaseAdmin.from('plu').update(updateData).eq('plu_id', id);
          if (error) return res.status(400).json({ error: error.message });
          if (oldPlu) {
            const changedFields = Object.keys(updateData).filter((key) => oldPlu[key] !== updateData[key]);
            for (const field of changedFields) {
              await supabaseAdmin.from('logbook').insert({
                entity: 'PLU',
                entity_label: `${oldPlu.plu_number}, ${oldPlu.name}`,
                field,
                old_value: oldPlu[field] ?? '',
                new_value: updateData[field] ?? '',
                username,
              });
            }
          }
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error updating PLU:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU: lookup by EAN ----
      app.get('/api/plu/ean/:barcode', async (req, res) => {
        try {
          const { barcode } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin.from('plu').select('*').eq('ean', barcode).maybeSingle();
          if (error) return res.status(400).json({ error: error.message });
          if (!data) return res.status(404).json({ error: 'Not found' });
          return res.json(data);
        } catch (err) {
          console.error('Server error looking up PLU by EAN:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- PLU: delete ----
      app.delete('/api/plu/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { error } = await supabaseAdmin.from('plu').delete().eq('plu_id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error deleting PLU:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Logbook: create entry ----
      app.post('/api/logbook/create', async (req, res) => {
        try {
          const { entity, entityLabel, field, oldValue, newValue, username, action } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          const insertData: Record<string, unknown> = {
            entity,
            entity_label: entityLabel,
            field,
            old_value: oldValue,
            new_value: newValue,
            username,
          };
          if (action) insertData.action = action;
          const { error } = await supabaseAdmin.from('logbook').insert(insertData);
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
          const supabaseAdmin = getSupabaseAdmin(server);
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

      // ---- Suppliers: fetch all ----
      app.get('/api/suppliers', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('suppliers')
            .select('*')
            .order('name');
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Server error fetching suppliers:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Suppliers: create ----
      app.post('/api/suppliers/create', async (req, res) => {
        try {
          const { username: _supplierUsername, name, contact_email, phone, address, payment_terms, vat_number, company_reg_number, bank_details } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('suppliers')
            .insert({ name, contact_email, phone, address, payment_terms, vat_number, company_reg_number, bank_details })
            .select()
            .single();
          if (error) return res.status(400).json({ error: error.message });

          // Log creation to logbook
          const username = req.body.username || 'system';
          await supabaseAdmin.from('logbook').insert({
            entity: 'Supplier',
            entity_label: name,
            field: '[CREATED]',
            old_value: '',
            new_value: `Supplier created with email: ${contact_email}`,
            username,
          });

          return res.json({ success: true, supplier: data });
        } catch (err) {
          console.error('Server error creating supplier:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Suppliers: update ----
      app.put('/api/suppliers/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const { username: _supplierUsername, ...updates } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);

          // Fetch old values for delta logging
          const { data: oldSupplier } = await supabaseAdmin
            .from('suppliers')
            .select('*')
            .eq('supplier_id', id)
            .single();

          const { data, error } = await supabaseAdmin
            .from('suppliers')
            .update(updates)
            .eq('supplier_id', id)
            .select()
            .single();
          if (error) return res.status(400).json({ error: error.message });

          // Log updates
          const username = req.body.username || 'system';
          if (oldSupplier) {
            for (const key of Object.keys(updates)) {
              const oldVal = JSON.stringify(oldSupplier[key]);
              const newVal = JSON.stringify(updates[key]);
              if (oldVal !== newVal) {
                await supabaseAdmin.from('logbook').insert({
                  entity: 'Supplier',
                  entity_label: oldSupplier.name,
                  field: key,
                  old_value: String(oldSupplier[key] || ''),
                  new_value: String(updates[key] || ''),
                  username,
                });
              }
            }
          }

          return res.json({ success: true, supplier: data });
        } catch (err) {
          console.error('Server error updating supplier:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Purchase Orders: fetch all ----
      app.get('/api/purchase-orders', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('purchase_orders')
            .select('*, suppliers(name), stores(name), purchase_order_items(*, plu(name, plu_number))')
            .order('created_at', { ascending: false });
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Server error fetching purchase orders:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Purchase Orders: create/update draft ----
      app.post('/api/purchase-orders/save-draft', async (req, res) => {
        try {
          const { supplier_id, store_id, items, created_by } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);

          // Check if there is an existing draft for this supplier/store
          let { data: po } = await supabaseAdmin
            .from('purchase_orders')
            .select('*')
            .eq('supplier_id', supplier_id)
            .eq('store_id', store_id)
            .eq('status', 'draft')
            .maybeSingle();

          if (!po) {
            const now = new Date();
            const year = now.getFullYear();
            const ts = String(Date.now()).slice(-6);
            const po_number = `PO-${year}-${ts}`;
            
            const { data: newPo, error: createError } = await supabaseAdmin
              .from('purchase_orders')
              .insert({
                po_number,
                supplier_id,
                store_id,
                status: 'draft',
                created_by
              })
              .select()
              .single();

            if (createError) return res.status(400).json({ error: createError.message });
            po = newPo;

            // Log draft creation in logbook
            const { data: supplierName } = await supabaseAdmin.from('suppliers').select('name').eq('supplier_id', supplier_id).single();
            await supabaseAdmin.from('logbook').insert({
              entity: 'Purchase Order',
              entity_label: po_number,
              field: 'status',
              old_value: '',
              new_value: `Draft Created (Supplier: ${supplierName?.name || 'Unknown'})`,
              username: 'system',
            });
          }

          // Insert or update order items
          let totalCost = 0;
          for (const item of items) {
            const cost = Number(item.cost_price_at_order || 0);
            totalCost += cost * Number(item.quantity_ordered);

            const { data: existingItem } = await supabaseAdmin
              .from('purchase_order_items')
              .select('*')
              .eq('po_id', po.po_id)
              .eq('plu_id', item.plu_id)
              .maybeSingle();

            if (existingItem) {
              await supabaseAdmin
                .from('purchase_order_items')
                .update({
                  quantity_ordered: existingItem.quantity_ordered + Number(item.quantity_ordered)
                })
                .eq('po_item_id', existingItem.po_item_id);
            } else {
              await supabaseAdmin
                .from('purchase_order_items')
                .insert({
                  po_id: po.po_id,
                  plu_id: item.plu_id,
                  quantity_ordered: Number(item.quantity_ordered),
                  cost_price_at_order: cost
                });
            }
          }

          // Update total cost
          const { data: finalPo } = await supabaseAdmin
            .from('purchase_orders')
            .update({ total_cost: totalCost })
            .eq('po_id', po.po_id)
            .select('*, suppliers(name), stores(name), purchase_order_items(*, plu(name, plu_number))')
            .single();

          return res.json({ success: true, purchase_order: finalPo });
        } catch (err) {
          console.error('Server error saving PO draft:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Purchase Orders: download and lock ----
      app.put('/api/purchase-orders/:id/lock', async (req, res) => {
        try {
          const { id } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);

          // Fetch the PO details for logging before updating status
          const { data: poDetails } = await supabaseAdmin
            .from('purchase_orders')
            .select('po_number')
            .eq('po_id', id)
            .single();

          const { error } = await supabaseAdmin
            .from('purchase_orders')
            .update({
              status: 'ordered',
              downloaded_at: new Date().toISOString()
            })
            .eq('po_id', id);

          if (error) return res.status(400).json({ error: error.message });

          // Log PO Finalized in logbook
          if (poDetails) {
            await supabaseAdmin.from('logbook').insert({
              entity: 'Purchase Order',
              entity_label: poDetails.po_number,
              field: 'status',
              old_value: 'draft',
              new_value: 'ordered (Locked & PDF Downloaded)',
              username: 'system',
            });
          }

          return res.json({ success: true });
        } catch (err) {
          console.error('Server error locking PO:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Stores: list active stores (for POS store selection) ----
      app.get('/api/stores', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin.from('stores').select('*').eq('is_active', true).order('name');
          if (error) return res.status(500).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- POS: PIN Login ----
      app.post('/api/pos/login', async (req, res) => {
        try {
          const { pin } = req.body;
          if (!pin || pin.length < 4) {
            return res.status(400).json({ error: 'PIN must be at least 4 digits' });
          }

          const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
          const supabaseAdmin = getSupabaseAdmin(server);

          const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('*, stores!users_assigned_store_id_fkey(name)')
            .eq('pin_hash', pinHash)
            .eq('is_active', true);

          if (error) return res.status(500).json({ error: error.message });

          if (!users || users.length === 0) {
            return res.status(401).json({ error: 'Invalid PIN' });
          }

          const user = users[0];
          return res.json({
            user: {
              user_id: user.user_id,
              username: user.username,
              full_name: user.full_name,
              role: user.role,
              assigned_store_id: user.assigned_store_id,
              assigned_store_name: user.stores?.name || null,
            },
          });
        } catch (err) {
          console.error('POS login error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- POS: Admin PIN Login (checks super_users, accepts store_id) ----
      app.post('/api/pos/admin-login', async (req, res) => {
        try {
          const { pin, store_id, store_name } = req.body;
          if (!pin || pin.length < 4) {
            return res.status(400).json({ error: 'PIN required' });
          }
          if (!/^\d{4,8}$/.test(String(pin))) {
            return res.status(400).json({ error: 'PIN must be 4-8 digits' });
          }
          if (!store_id) {
            return res.status(400).json({ error: 'store_id required' });
          }
          const pinHash = crypto.createHash('sha256').update(String(pin)).digest('hex');
          const supabasePublic = getSupabaseAdmin(server, 'public');
          const { data: su, error } = await supabasePublic
            .from('super_users')
            .select('*')
            .eq('pin_hash', pinHash)
            .eq('is_active', true)
            .maybeSingle();
          if (error) return res.status(500).json({ error: error.message });
          if (!su) return res.status(401).json({ error: 'Invalid PIN' });
          return res.json({
            user: {
              user_id: su.super_user_id,
              username: su.email.split('@')[0],
              full_name: su.full_name,
              role: 'super_admin',
              assigned_store_id: store_id,
              assigned_store_name: store_name || null,
            },
          });
        } catch (err) {
          console.error('POS admin login error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Supplier Products: list (with PLU details) ----
      app.get('/api/supplier-products', async (req, res) => {
        try {
          const { supplier_id } = req.query;
          const supabaseAdmin = getSupabaseAdmin(server);
          let query = supabaseAdmin
            .from('supplier_products')
            .select('*, plu(plu_id, plu_number, name)');
          if (supplier_id) query = query.eq('supplier_id', supplier_id);
          const { data, error } = await query;
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Server error fetching supplier products:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Supplier Products: delete ----
      app.delete('/api/supplier-products/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { error } = await supabaseAdmin
            .from('supplier_products')
            .delete()
            .eq('supplier_product_id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Server error deleting supplier product:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Supplier Products: link product to supplier ----
      app.post('/api/supplier-products/link', async (req, res) => {
        try {
          const { supplier_id, plu_id, supplier_sku, cost_price, is_preferred, lead_time_days } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);

          const { data, error } = await supabaseAdmin
            .from('supplier_products')
            .upsert({
              supplier_id,
              plu_id,
              supplier_sku,
              cost_price,
              is_preferred,
              lead_time_days
            }, { onConflict: 'supplier_id,plu_id' })
            .select()
            .single();

          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, supplier_product: data });
        } catch (err) {
          console.error('Server error mapping supplier product:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Purchase Orders: auto-suggest ----
      app.post('/api/purchase-orders/suggestions', async (req, res) => {
        try {
          const { store_id } = req.body;
          if (!store_id) return res.status(400).json({ error: 'store_id is required' });

          const supabaseAdmin = getSupabaseAdmin(server);
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000).toISOString();

          // Get store name
          const { data: store } = await supabaseAdmin
            .from('stores')
            .select('name')
            .eq('store_id', store_id)
            .single();
          const storeName = store?.name || 'Unknown';

          // Fetch all preferred supplier_products with PLU + supplier info
          const { data: supplierProducts, error: spError } = await supabaseAdmin
            .from('supplier_products')
            .select('*, plu(plu_id, plu_number, name), suppliers!inner(supplier_id, name)')
            .eq('is_preferred', true);

          if (spError) return res.status(400).json({ error: spError.message });

          if (!supplierProducts || supplierProducts.length === 0) {
            return res.json({ suggestions: [] });
          }

          // Fetch sales data (last 7 days) for this store
          const { data: salesData } = await supabaseAdmin
            .from('sale_items')
            .select('plu_name, quantity, sales_transactions!inner(store_id, created_at)')
            .gte('sales_transactions.created_at', sevenDaysAgo)
            .eq('sales_transactions.store_id', store_id);

          // Aggregate daily sales per PLU name
          const salesMap = new Map<string, number>();
          if (salesData) {
            for (const si of salesData) {
              const curr = salesMap.get(si.plu_name) ?? 0;
              salesMap.set(si.plu_name, curr + Number(si.quantity));
            }
          }

          // Fetch historical receipts (last 8 weeks) for this store
          const { data: receiptData } = await supabaseAdmin
            .from('purchase_order_items')
            .select('plu_id, quantity_received, purchase_orders!inner(store_id, received_at, status)')
            .in('purchase_orders.status', ['received', 'partially_received'])
            .gte('purchase_orders.received_at', eightWeeksAgo)
            .eq('purchase_orders.store_id', store_id);

          // Aggregate average receipt per PLU
          const receiptMap = new Map<string, { total: number; count: number }>();
          if (receiptData) {
            for (const ri of receiptData) {
              const qty = Number(ri.quantity_received);
              if (qty <= 0) continue;
              const curr = receiptMap.get(ri.plu_id) ?? { total: 0, count: 0 };
              curr.total += qty;
              curr.count += 1;
              receiptMap.set(ri.plu_id, curr);
            }
          }

          // Group results by supplier
          const supplierGroups = new Map<string, {
            supplier_id: string;
            supplier_name: string;
            items: any[];
            total_cost: number;
          }>();

          for (const sp of supplierProducts) {
            const plu = (sp as any).plu;
            const supplier = (sp as any).suppliers;
            if (!plu || !supplier) continue;

            const totalSales7d = plu ? (salesMap.get(plu.name) ?? 0) : 0;
            const avgDailySales = totalSales7d / 7;

            const receiptAgg = receiptMap.get(sp.plu_id);
            const avgReceipt8wk = receiptAgg ? receiptAgg.total / receiptAgg.count : 0;

            // Suggested qty formula
            let suggestedQty = 0;
            if (avgDailySales > 0) {
              suggestedQty = Math.max(avgReceipt8wk, Math.ceil(avgDailySales * sp.lead_time_days));
            } else {
              suggestedQty = Math.ceil(avgReceipt8wk);
            }

            if (suggestedQty <= 0) continue;

            const group = supplierGroups.get(supplier.supplier_id) ?? {
              supplier_id: supplier.supplier_id,
              supplier_name: supplier.name,
              items: [] as any[],
              total_cost: 0,
            };

            const cost = Number(sp.cost_price) * suggestedQty;
            group.items.push({
              plu_id: sp.plu_id,
              plu_number: plu.plu_number,
              plu_name: plu.name,
              avg_receipt_8wk: Math.round(avgReceipt8wk * 100) / 100,
              avg_daily_sales: Math.round(avgDailySales * 100) / 100,
              lead_time_days: sp.lead_time_days,
              supplier_sku: sp.supplier_sku ?? undefined,
              suggested_qty: suggestedQty,
            });
            group.total_cost += cost;
            supplierGroups.set(supplier.supplier_id, group);
          }

          const suggestions = Array.from(supplierGroups.values()).map((g) => ({
            supplier_id: g.supplier_id,
            supplier_name: g.supplier_name,
            store_id,
            store_name: storeName,
            items: g.items,
            total_suggested_cost: Math.round(g.total_cost * 100) / 100,
          }));

          return res.json({ suggestions });
        } catch (err) {
          console.error('Server error generating PO suggestions:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- POS: Clock In ----
      app.post('/api/pos/clock-in', async (req, res) => {
        try {
          const { store_id, user_id } = req.body;
          if (!store_id || !user_id) return res.status(400).json({ error: 'store_id and user_id required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('staff_timesheets')
            .insert({ store_id, user_id, clock_in: new Date().toISOString() })
            .select()
            .single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, timesheet: data });
        } catch (err) {
          console.error('Clock in error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- POS: Clock Out ----
      app.put('/api/pos/clock-out', async (req, res) => {
        try {
          const { user_id } = req.body;
          if (!user_id) return res.status(400).json({ error: 'user_id required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data: open } = await supabaseAdmin
            .from('staff_timesheets')
            .select('*')
            .eq('user_id', user_id)
            .is('clock_out', null)
            .order('clock_in', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!open) return res.status(400).json({ error: 'No open clock-in found' });
          const { data, error } = await supabaseAdmin
            .from('staff_timesheets')
            .update({ clock_out: new Date().toISOString() })
            .eq('timesheet_id', open.timesheet_id)
            .select()
            .single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, timesheet: data });
        } catch (err) {
          console.error('Clock out error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- POS: Clock Status ----
      app.get('/api/pos/clock-status', async (req, res) => {
        try {
          const { user_id } = req.query;
          if (!user_id) return res.status(400).json({ error: 'user_id required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('staff_timesheets')
            .select('*')
            .eq('user_id', user_id)
            .order('clock_in', { ascending: false })
            .limit(5);
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Clock status error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Checklists: list templates ----
      app.get('/api/checklists', async (req, res) => {
        try {
          const { store_id, type } = req.query;
          if (!store_id) return res.status(400).json({ error: 'store_id required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          let query = supabaseAdmin
            .from('store_checklists')
            .select('*')
            .eq('store_id', store_id)
            .order('sort_order', { ascending: true });
          if (type) query = query.eq('type', type);
          const { data, error } = await query;
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Fetch checklists error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Checklists: create task ----
      app.post('/api/checklists/create', async (req, res) => {
        try {
          const { store_id, type, task_name, sort_order } = req.body;
          if (!store_id || !type || !task_name) return res.status(400).json({ error: 'store_id, type, and task_name required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('store_checklists')
            .insert({ store_id, type, task_name, sort_order: sort_order ?? 0 })
            .select()
            .single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, checklist: data });
        } catch (err) {
          console.error('Create checklist error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Checklists: update task ----
      app.put('/api/checklists/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const { task_name, sort_order, type } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          const updates: Record<string, unknown> = {};
          if (task_name !== undefined) updates.task_name = task_name;
          if (sort_order !== undefined) updates.sort_order = sort_order;
          if (type !== undefined) updates.type = type;
          const { error } = await supabaseAdmin
            .from('store_checklists')
            .update(updates)
            .eq('checklist_id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Update checklist error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Checklists: delete task ----
      app.delete('/api/checklists/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { error } = await supabaseAdmin
            .from('store_checklists')
            .delete()
            .eq('checklist_id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Delete checklist error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Purchase Orders: pending (for Goods In) ----
      app.get('/api/purchase-orders/pending', async (req, res) => {
        try {
          const { store_id } = req.query;
          if (!store_id) return res.status(400).json({ error: 'store_id required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin
            .from('purchase_orders')
            .select('*, suppliers(name), purchase_order_items(*, plu(name, plu_number))')
            .eq('store_id', store_id)
            .eq('status', 'ordered')
            .order('created_at', { ascending: false });
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Fetch pending POs error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Purchase Orders: receive delivery (Goods In) ----
      app.post('/api/purchase-orders/receive', async (req, res) => {
        try {
          const { po_id, items } = req.body;
          if (!po_id || !items?.length) return res.status(400).json({ error: 'po_id and items required' });
          const supabaseAdmin = getSupabaseAdmin(server);

          const { data: po } = await supabaseAdmin
            .from('purchase_orders')
            .select('store_id')
            .eq('po_id', po_id)
            .single();
          if (!po) return res.status(404).json({ error: 'PO not found' });

          for (const item of items) {
            const { plu_id, qty_received } = item;
            if (!plu_id || qty_received == null) continue;

            // Update quantity_received on purchase_order_items
            const { data: existingItem } = await supabaseAdmin
              .from('purchase_order_items')
              .select('*')
              .eq('po_id', po_id)
              .eq('plu_id', plu_id)
              .single();
            if (!existingItem) continue;

            const newQty = (existingItem.quantity_received || 0) + Number(qty_received);
            await supabaseAdmin
              .from('purchase_order_items')
              .update({ quantity_received: newQty })
              .eq('po_item_id', existingItem.po_item_id);

            // Check inventory — update stock_quantity
            const { data: invItem } = await supabaseAdmin
              .from('inventory')
              .select('product_id, stock_quantity')
              .eq('store_id', po.store_id)
              .eq('name', existingItem.plu_id)
              .maybeSingle();

            if (invItem) {
              await supabaseAdmin
                .from('inventory')
                .update({ stock_quantity: (invItem.stock_quantity || 0) + Number(qty_received) })
                .eq('product_id', invItem.product_id);
            } else {
              // Get PLU name for inventory entry
              const { data: _plu } = await supabaseAdmin
                .from('plu')
                .select('name')
                .eq('plu_id', plu_id)
                .single();
              await supabaseAdmin
                .from('inventory')
                .insert({
                  store_id: po.store_id,
                  name: plu_id, // using plu_id as name as per existing schema pattern
                  stock_quantity: Number(qty_received),
                  price: existingItem.cost_price_at_order,
                });
            }
          }

          // Update PO status if all items fully received
          const { data: allItems } = await supabaseAdmin
            .from('purchase_order_items')
            .select('quantity_ordered, quantity_received')
            .eq('po_id', po_id);

          const allFullyReceived = allItems?.every((i) => i.quantity_received >= i.quantity_ordered);
          const anyReceived = allItems?.some((i) => i.quantity_received > 0);
          let newStatus = 'ordered';
          if (allFullyReceived) newStatus = 'received';
          else if (anyReceived) newStatus = 'partially_received';

          await supabaseAdmin
            .from('purchase_orders')
            .update({ status: newStatus, received_at: new Date().toISOString() })
            .eq('po_id', po_id);

          return res.json({ success: true, status: newStatus });
        } catch (err) {
          console.error('Receive delivery error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Settings: get currency ----
      app.get('/api/settings/currency', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'currency').single();
          return res.json(data?.value || { symbol: '£', code: 'GBP', notes: [50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] });
        } catch (err) {
          console.error('Get currency error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Settings: update currency ----
      app.put('/api/settings/currency', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { error } = await supabaseAdmin.from('system_settings').update({ value: req.body, updated_at: new Date().toISOString() }).eq('key', 'currency');
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Update currency error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Loyalty Cards: list / search ----
      app.get('/api/loyalty-cards', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin.from('loyalty_cards').select('*').order('customer_name');
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Fetch loyalty cards error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Loyalty Cards: create ----
      app.post('/api/loyalty-cards/create', async (req, res) => {
        try {
          const { customer_name, phone, email, cashback_balance } = req.body;
          if (!customer_name) return res.status(400).json({ error: 'customer_name required' });
          const supabaseAdmin = getSupabaseAdmin(server);

          // Generate unique card number: LC-YYYYMMDD-XXXX
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const { count } = await supabaseAdmin.from('loyalty_cards').select('card_number', { count: 'exact', head: true })
            .like('card_number', `LC-${today}-%`);
          const seq = String((count ?? 0) + 1).padStart(4, '0');
          const card_number = `LC-${today}-${seq}`;

          const { data, error } = await supabaseAdmin.from('loyalty_cards').insert({
            store_id: req.body.store_id || null,
            card_number,
            customer_name: customer_name.trim(),
            phone: phone || null,
            email: email || null,
            cashback_balance: cashback_balance ?? 0,
          }).select().single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, card: data });
        } catch (err) {
          console.error('Create loyalty card error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Loyalty Cards: update ----
      app.put('/api/loyalty-cards/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { error } = await supabaseAdmin.from('loyalty_cards').update(req.body).eq('card_id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Update loyalty card error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Loyalty Cards: lookup by card number ----
      app.get('/api/loyalty-cards/lookup/:code', async (req, res) => {
        try {
          const { code } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const cleaned = code.replace(/^loyalty:/, '');
          const { data, error } = await supabaseAdmin.from('loyalty_cards')
            .select('*')
            .eq('card_number', cleaned)
            .eq('is_active', true)
            .single();
          if (error) return res.status(404).json({ error: 'Card not found' });
          return res.json(data);
        } catch (err) {
          console.error('Lookup loyalty card error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Sales: create ----
      app.post('/api/sales/create', async (req, res) => {
        try {
          const { store_id, staff_user_id, items, total_amount, discount_amount, payment_method, payment_note, loyalty_card_id } = req.body;
          if (!store_id || !staff_user_id || !items?.length) {
            return res.status(400).json({ error: 'store_id, staff_user_id, and items required' });
          }
          const supabaseAdmin = getSupabaseAdmin(server);

          // Create transaction
          const { data: transaction, error: txErr } = await supabaseAdmin.from('sales_transactions').insert({
            store_id,
            staff_user_id,
            total_amount,
            discount_amount: discount_amount || 0,
            payment_method: payment_method || 'cash',
            payment_note: payment_note || null,
            loyalty_card_id: loyalty_card_id || null,
            status: 'completed',
          }).select().single();
          if (txErr) return res.status(400).json({ error: txErr.message });

          const saleId = transaction.transaction_id;

          // Insert sale items and deduct inventory
          for (const item of items) {
            const { error: itemErr } = await supabaseAdmin.from('sale_items').insert({
              transaction_id: saleId,
              plu_id: item.plu_id || null,
              plu_name: item.plu_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            });
            if (itemErr) {
              console.error('Insert sale item error:', itemErr);
              continue;
            }
            // Deduct from inventory
            const { data: invItem } = await supabaseAdmin.from('inventory')
              .select('product_id, stock_quantity')
              .eq('store_id', store_id)
              .eq('name', item.plu_name)
              .maybeSingle();
            if (invItem) {
              const newQty = Math.max(0, (invItem.stock_quantity || 0) - item.quantity);
              await supabaseAdmin.from('inventory').update({ stock_quantity: newQty }).eq('product_id', invItem.product_id);
            }
          }

          // Deduct loyalty cashback if used
          if (loyalty_card_id && discount_amount > 0) {
            const { data: card } = await supabaseAdmin.from('loyalty_cards')
              .select('cashback_balance').eq('card_id', loyalty_card_id).single();
            if (card) {
              const newBalance = Math.max(0, (card.cashback_balance || 0) - discount_amount);
              await supabaseAdmin.from('loyalty_cards').update({ cashback_balance: newBalance }).eq('card_id', loyalty_card_id);
            }
          }

          // Accrue loyalty cashback for this purchase
          if (loyalty_card_id) {
            const { data: settings } = await supabaseAdmin.from('system_settings')
              .select('value').eq('key', 'loyalty_cashback_percent').single();
            const percent = settings?.value?.percent ?? 0;
            if (percent > 0) {
              const cashbackEarned = (total_amount * percent) / 100;
              const { data: card } = await supabaseAdmin.from('loyalty_cards')
                .select('cashback_balance').eq('card_id', loyalty_card_id).single();
              if (card) {
                await supabaseAdmin.from('loyalty_cards')
                  .update({ cashback_balance: (card.cashback_balance || 0) + cashbackEarned })
                  .eq('card_id', loyalty_card_id);
              }
            }
          }

          return res.json({ success: true, transaction });
        } catch (err) {
          console.error('Create sale error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Sales: list ----
      app.get('/api/sales', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const storeId = req.query.store_id as string;
          const date = req.query.date as string;
          let query = supabaseAdmin.from('sales_transactions').select('*, sale_items(*)').order('created_at', { ascending: false });
          if (storeId) query = query.eq('store_id', storeId);
          if (date) {
            const start = `${date}T00:00:00Z`;
            const end = `${date}T23:59:59Z`;
            query = query.gte('created_at', start).lte('created_at', end);
          }
          const { data, error } = await query;
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('List sales error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Sales: void ----
      app.post('/api/sales/void', async (req, res) => {
        try {
          const { transaction_id } = req.body;
          if (!transaction_id) return res.status(400).json({ error: 'transaction_id required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data: tx } = await supabaseAdmin.from('sales_transactions').select('*').eq('transaction_id', transaction_id).single();
          if (!tx) return res.status(404).json({ error: 'Transaction not found' });
          if (tx.status === 'void') return res.status(400).json({ error: 'Already voided' });

          // Restore inventory
          const { data: items } = await supabaseAdmin.from('sale_items').select('*').eq('transaction_id', transaction_id);
          if (items) {
            for (const item of items) {
              const { data: invItem } = await supabaseAdmin.from('inventory')
                .select('product_id, stock_quantity')
                .eq('store_id', tx.store_id)
                .eq('name', item.plu_name)
                .maybeSingle();
              if (invItem) {
                await supabaseAdmin.from('inventory').update({ stock_quantity: (invItem.stock_quantity || 0) + item.quantity }).eq('product_id', invItem.product_id);
              }
            }
          }

          // Restore loyalty cashback if deducted
          if (tx.loyalty_card_id && tx.discount_amount > 0) {
            const { data: card } = await supabaseAdmin.from('loyalty_cards').select('cashback_balance').eq('card_id', tx.loyalty_card_id).single();
            if (card) {
              await supabaseAdmin.from('loyalty_cards').update({ cashback_balance: (card.cashback_balance || 0) + tx.discount_amount }).eq('card_id', tx.loyalty_card_id);
            }
          }

          // Subtract cashback that was earned on this sale
          if (tx.loyalty_card_id) {
            const { data: settings } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'loyalty_cashback_percent').single();
            const percent = settings?.value?.percent ?? 0;
            if (percent > 0) {
              const cashbackEarned = (tx.total_amount * percent) / 100;
              const { data: card } = await supabaseAdmin.from('loyalty_cards').select('cashback_balance').eq('card_id', tx.loyalty_card_id).single();
              if (card) {
                await supabaseAdmin.from('loyalty_cards').update({ cashback_balance: Math.max(0, (card.cashback_balance || 0) - cashbackEarned) }).eq('card_id', tx.loyalty_card_id);
              }
            }
          }

          const { error } = await supabaseAdmin.from('sales_transactions').update({ status: 'void' }).eq('transaction_id', transaction_id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Void sale error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Settings: cashback percent ----
      app.get('/api/settings/loyalty-cashback-percent', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'loyalty_cashback_percent').single();
          return res.json({ percent: data?.value?.percent ?? 5 });
        } catch (err) {
          console.error('Get cashback percent error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      app.put('/api/settings/loyalty-cashback-percent', async (req, res) => {
        try {
          const { percent } = req.body;
          const supabaseAdmin = getSupabaseAdmin(server);
          await supabaseAdmin.from('system_settings').upsert({ key: 'loyalty_cashback_percent', value: { percent }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
          return res.json({ success: true });
        } catch (err) {
          console.error('Update cashback percent error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Loyalty Notifications: list ----
      app.get('/api/loyalty-notifications', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin.from('loyalty_notifications').select('*').order('created_at', { ascending: false });
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('List notifications error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Loyalty Notifications: create ----
      app.post('/api/loyalty-notifications/create', async (req, res) => {
        try {
          const { title, body, store_id } = req.body;
          if (!title || !body) return res.status(400).json({ error: 'title and body required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin.from('loyalty_notifications').insert({
            title, body, store_id: store_id || null,
          }).select().single();
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true, notification: data });
        } catch (err) {
          console.error('Create notification error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Loyalty Notifications: send ----
      app.post('/api/loyalty-notifications/:id/send', async (req, res) => {
        try {
          const { id } = req.params;
          const supabaseAdmin = getSupabaseAdmin(server);
          const { error } = await supabaseAdmin.from('loyalty_notifications').update({ sent_at: new Date().toISOString() }).eq('notification_id', id);
          if (error) return res.status(400).json({ error: error.message });
          return res.json({ success: true });
        } catch (err) {
          console.error('Send notification error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // ---- Loyalty Notifications: unseen by store ----
      app.get('/api/loyalty-notifications/unseen', async (req, res) => {
        try {
          const storeId = req.query.store_id as string;
          if (!storeId) return res.status(400).json({ error: 'store_id required' });
          const supabaseAdmin = getSupabaseAdmin(server);
          const { data, error } = await supabaseAdmin.from('loyalty_notifications')
            .select('*')
            .or(`store_id.eq.${storeId},store_id.is.null`)
            .not('sent_at', 'is', null)
            .order('created_at', { ascending: false });
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          console.error('Unseen notifications error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });


      // ---- Admin: list tenants ----
      app.get('/api/admin/tenants', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { data: tenants } = await supabaseAdmin.from('tenants').select('*').order('created_at', { ascending: false });
          const { data: subs } = await supabaseAdmin.from('tenant_subscriptions').select('*, plans(name)');
          const subMap = new Map((subs || []).map((s: any) => [s.tenant_id, s]));
          const enriched = (tenants || []).map((t: any) => ({
            ...t,
            plan_name: subMap.get(t.tenant_id)?.plans?.name || null,
            subscription_status: subMap.get(t.tenant_id)?.status || null,
          }));
          return res.json(enriched);
        } catch (err) {
          return res.status(500).json({ error: 'Failed to fetch tenants' });
        }
      });

      // ---- Admin: update tenant ----
      app.put('/api/admin/tenants/:tenantId', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { tenantId } = req.params;
          const { name, slug, domain, is_active, plan_id } = req.body;

          const { data: existing } = await supabaseAdmin.from('tenants').select('tenant_id').eq('tenant_id', tenantId).maybeSingle();
          if (!existing) return res.status(404).json({ error: 'Tenant not found' });

          const update: Record<string, any> = {};
          if (name !== undefined) update.name = String(name).trim();
          if (domain !== undefined) update.domain = domain ? String(domain).trim() : null;
          if (is_active !== undefined) update.is_active = !!is_active;
          if (slug !== undefined) {
            const cleanSlug = String(slug).trim().toLowerCase();
            if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
              return res.status(400).json({ error: 'Slug can only contain lowercase letters, numbers, and hyphens' });
            }
            const { data: clash } = await supabaseAdmin.from('tenants').select('tenant_id').eq('slug', cleanSlug).neq('tenant_id', tenantId).maybeSingle();
            if (clash) return res.status(400).json({ error: 'Slug already in use by another tenant' });
            update.slug = cleanSlug;
          }
          if (plan_id !== undefined && plan_id) update.plan_id = plan_id;

          if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No fields to update' });

          const { error: updError } = await supabaseAdmin.from('tenants').update(update).eq('tenant_id', tenantId);
          if (updError) return res.status(400).json({ error: updError.message });

          if (update.plan_id) {
            const { data: sub } = await supabaseAdmin.from('tenant_subscriptions').select('subscription_id').eq('tenant_id', tenantId).maybeSingle();
            if (sub) {
              const { error: subError } = await supabaseAdmin.from('tenant_subscriptions')
                .update({ plan_id: update.plan_id, status: 'active', starts_at: new Date().toISOString() })
                .eq('subscription_id', sub.subscription_id);
              if (subError) return res.status(400).json({ error: subError.message });
            } else {
              const { error: subError } = await supabaseAdmin.from('tenant_subscriptions')
                .insert({ tenant_id: tenantId, plan_id: update.plan_id, status: 'active' });
              if (subError) return res.status(400).json({ error: subError.message });
            }
          }
          return res.json({ success: true });
        } catch (err: any) {
          return res.status(500).json({ error: err.message || 'Failed to update tenant' });
        }
      });

      // ---- Admin: invite tenant main user (when none exists) ----
      app.post('/api/admin/tenants/:tenantId/main-user', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('tenant_id', req.params.tenantId).maybeSingle();
          if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
          const { email, full_name } = req.body;
          if (!email || !full_name) return res.status(400).json({ error: 'email and full_name required' });

          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = (authUsers?.users || []).find((u: any) => u.user_metadata?.tenant_schema === tenant.schema_name);
          if (existing) return res.status(400).json({ error: 'This tenant already has a main user' });

          const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { tenant_schema: tenant.schema_name, is_tenant_admin: true, full_name },
          });
          if (inviteError) return res.status(400).json({ error: inviteError.message });

          let warning: string | null = null;
          try {
            const tenantAdmin = getSupabaseAdmin(server, tenant.schema_name);
            const { error: dbError } = await tenantAdmin.from('users').insert({
              user_id: inviteData?.user?.id,
              username: email.split('@')[0],
              email,
              full_name,
              role: 'super_user',
              is_active: true,
            });
            if (dbError) warning = `Invite sent, but tenant profile could not be created: ${dbError.message}`;
          } catch (e: any) {
            warning = `Invite sent, but tenant profile could not be created: ${e.message}`;
          }
          return res.json({ success: true, user_id: inviteData?.user?.id, ...(warning ? { warning } : {}) });
        } catch (err: any) {
          return res.status(500).json({ error: err.message || 'Failed to invite main user' });
        }
      });

      // ---- Admin: get tenant main user ----
      app.get('/api/admin/tenants/:tenantId/main-user', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('tenant_id', req.params.tenantId).maybeSingle();
          if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

          let dbRow: any = null;
          try {
            const tenantAdmin = getSupabaseAdmin(server, tenant.schema_name);
            const { data, error } = await tenantAdmin.from('users')
              .select('*').eq('role', 'super_user').order('created_at', { ascending: true }).limit(1).maybeSingle();
            if (!error && data) dbRow = data;
          } catch { /* tenant schema may not exist yet */ }

          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const metaMatch = (authUsers?.users || []).find((u: any) => u.user_metadata?.tenant_schema === tenant.schema_name);
          const authUser = dbRow
            ? (authUsers?.users || []).find((u: any) => u.id === dbRow.user_id) || metaMatch
            : metaMatch;

          if (!authUser && !dbRow) return res.status(404).json({ error: 'No main user found for this tenant' });

          return res.json({
            user_id: dbRow?.user_id || authUser?.id,
            email: dbRow?.email || authUser?.email,
            full_name: dbRow?.full_name || authUser?.user_metadata?.full_name || '',
            username: dbRow?.username || (authUser?.email ? authUser.email.split('@')[0] : ''),
            role: dbRow?.role || 'super_user',
            is_active: dbRow?.is_active ?? true,
            requires_password_change: !!dbRow?.requires_password_change,
            auth: {
              confirmed_at: authUser?.confirmed_at || null,
              last_sign_in_at: authUser?.last_sign_in_at || null,
              invited_at: authUser?.created_at || null,
            },
          });
        } catch (err: any) {
          return res.status(500).json({ error: err.message || 'Failed to fetch main user' });
        }
      });

      // ---- Admin: update tenant main user ----
      app.put('/api/admin/tenants/:tenantId/main-user', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { data: tenant } = await supabaseAdmin.from('tenants').select('schema_name').eq('tenant_id', req.params.tenantId).maybeSingle();
          if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
          const { user_id, full_name, username, email, is_active } = req.body;
          if (!user_id || !full_name || !username || !email) {
            return res.status(400).json({ error: 'user_id, full_name, username, and email required' });
          }
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
            return res.status(400).json({ error: 'Invalid user_id' });
          }

          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
          if (!authUser?.user) return res.status(404).json({ error: 'Auth user not found' });

          const authUpdate: any = { user_metadata: { ...(authUser.user.user_metadata || {}), full_name } };
          if (email !== authUser.user.email) authUpdate.email = email;
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate);
          if (authError) return res.status(400).json({ error: authError.message });

          let warning: string | null = null;
          try {
            const tenantAdmin = getSupabaseAdmin(server, tenant.schema_name);
            const { error: dbError } = await tenantAdmin.from('users')
              .update({ full_name, username, email, is_active: !!is_active })
              .eq('user_id', user_id);
            if (dbError) warning = `Auth user updated, but tenant profile could not be updated: ${dbError.message}`;
          } catch (e: any) {
            warning = `Auth user updated, but tenant profile could not be updated: ${e.message}`;
          }
          return res.json({ success: true, ...(warning ? { warning } : {}) });
        } catch (err: any) {
          return res.status(500).json({ error: err.message || 'Failed to update main user' });
        }
      });

      // ---- Admin: resend tenant main user access email ----
      app.post('/api/admin/tenants/:tenantId/main-user/resend-invite', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { data: tenant } = await supabaseAdmin.from('tenants').select('schema_name').eq('tenant_id', req.params.tenantId).maybeSingle();
          if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const authUser = (authUsers?.users || []).find((u: any) => u.user_metadata?.tenant_schema === tenant.schema_name);
          if (!authUser) return res.status(404).json({ error: 'No main user found for this tenant' });

          if (!authUser.confirmed_at) {
            const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(authUser.email!, {
              data: { tenant_schema: tenant.schema_name, is_tenant_admin: true },
            });
            if (inviteError) return res.status(400).json({ error: inviteError.message });
            return res.json({ success: true, method: 'invite' });
          }

          const env = loadEnv(server.config.mode, process.cwd(), '');
          const anon = createClient(env.VITE_SUPABASE_URL || '', env.VITE_SUPABASE_ANON_KEY || '');
          const { error: resetError } = await anon.auth.resetPasswordForEmail(authUser.email!, {
            redirectTo: process.env.APP_URL || req.headers.origin || undefined,
          });
          if (resetError) return res.status(400).json({ error: resetError.message });
          return res.json({ success: true, method: 'recovery' });
        } catch (err: any) {
          return res.status(500).json({ error: err.message || 'Failed to resend access email' });
        }
      });

      // ---- Admin: reset tenant main user password ----
      app.post('/api/admin/tenants/:tenantId/main-user/reset-password', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { user_id, new_password } = req.body;
          if (!user_id || !new_password) return res.status(400).json({ error: 'user_id and new_password required' });
          if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
            return res.status(400).json({ error: 'Invalid user_id' });
          }
          const { data: tenant } = await supabaseAdmin.from('tenants').select('schema_name').eq('tenant_id', req.params.tenantId).maybeSingle();
          if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
          if (authError) return res.status(400).json({ error: authError.message });

          let warning: string | null = null;
          try {
            const tenantAdmin = getSupabaseAdmin(server, tenant.schema_name);
            const { error: dbError } = await tenantAdmin.from('users')
              .update({ requires_password_change: true }).eq('user_id', user_id);
            if (dbError) warning = `Password updated, but force-change flag could not be set: ${dbError.message}`;
          } catch (e: any) {
            warning = `Password updated, but force-change flag could not be set: ${e.message}`;
          }
          return res.json({ success: true, ...(warning ? { warning } : {}) });
        } catch (err: any) {
          return res.status(500).json({ error: err.message || 'Failed to reset password' });
        }
      });

      // ---- Admin: list stores for a given tenant schema ----
      app.get('/api/admin/stores', async (req, res) => {
        try {
          const schema = req.query.schema as string;
          if (!schema) return res.status(400).json({ error: 'schema query param required' });
          const tenantAdmin = getSupabaseAdmin(server, schema);
          const { data, error } = await tenantAdmin.from('stores').select('*').eq('is_active', true).order('name');
          if (error) return res.status(500).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          return res.status(500).json({ error: 'Failed to fetch stores' });
        }
      });

      // ---- Admin: provision tenant ----
      app.post('/api/admin/provision-tenant', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { name, slug, plan_id, admin_email, admin_name } = req.body;
          if (!name || !slug || !plan_id || !admin_email || !admin_name) {
            return res.status(400).json({ error: 'All fields required' });
          }

          // Call the provision_tenant function
          const { data, error } = await supabaseAdmin.rpc('provision_tenant', {
            p_tenant_name: name,
            p_slug: slug,
            p_plan_id: plan_id,
          });

          if (error) return res.status(400).json({ error: error.message });
          const tenantId = data;

          // Invite the admin user
          const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(admin_email, {
            data: { tenant_schema: `tenant_${tenantId?.toString().replace(/-/g, '')}`, is_tenant_admin: true },
          });

          if (inviteError) {
            return res.json({ tenant_id: tenantId, warning: `Tenant created but invite failed: ${inviteError.message}` });
          }

          if (inviteData?.user) {
            // Insert into tenant's users table
            const schemaName = `tenant_${tenantId?.toString().replace(/-/g, '')}`;
            const tenantAdmin = getSupabaseAdmin(server, schemaName);
            await tenantAdmin.from('users').insert({
              user_id: inviteData.user.id,
              username: admin_email.split('@')[0],
              email: admin_email,
              full_name: admin_name,
              role: 'super_user',
              is_active: true,
            });
          }

          return res.json({ tenant_id: tenantId, message: 'Tenant provisioned successfully' });
        } catch (err: any) {
          return res.status(500).json({ error: err.message || 'Provisioning failed' });
        }
      });

      // ---- Admin: list super users ----
      app.get('/api/admin/super-users', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { data, error } = await supabaseAdmin.from('super_users').select('*').order('created_at', { ascending: false });
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          return res.status(500).json({ error: 'Failed to fetch super users' });
        }
      });

      // ---- Admin: invite super user ----
      app.post('/api/admin/super-users/invite', async (req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { email, full_name, role } = req.body;
          if (!email || !full_name || !role) {
            return res.status(400).json({ error: 'email, full_name, and role required' });
          }

          const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { is_super_admin: role === 'super_admin', is_support: role === 'support', full_name },
          });

          if (inviteError) return res.status(400).json({ error: inviteError.message });
          if (!inviteData?.user) return res.status(400).json({ error: 'Failed to create user' });

          const { error: insertError } = await supabaseAdmin.from('super_users').insert({
            super_user_id: inviteData.user.id,
            email,
            full_name,
            role,
            is_active: true,
          });
          if (insertError) return res.status(400).json({ error: insertError.message });

          return res.json({ success: true, super_user_id: inviteData.user.id });
        } catch (err: any) {
          return res.status(500).json({ error: err.message || 'Invite failed' });
        }
      });

      // ---- Admin: list plans ----
      app.get('/api/admin/plans', async (_req, res) => {
        try {
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { data, error } = await supabaseAdmin.from('plans').select('*').order('price');
          if (error) return res.status(400).json({ error: error.message });
          return res.json(data);
        } catch (err) {
          return res.status(500).json({ error: 'Failed to fetch plans' });
        }
      });

      // ---- Admin: change PIN (4-8 digits, stored as sha256 hash) ----
      app.post('/api/admin/settings/change-pin', async (req, res) => {
        try {
          const { user_id, pin } = req.body;
          if (!user_id || !pin) {
            return res.status(400).json({ error: 'user_id and pin required' });
          }
          if (!/^\d{4,8}$/.test(String(pin))) {
            return res.status(400).json({ error: 'PIN must be 4-8 digits' });
          }
          const pinHash = crypto.createHash('sha256').update(String(pin)).digest('hex');
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { error: dbError } = await supabaseAdmin.from('super_users').update({ pin_hash: pinHash }).eq('super_user_id', user_id);
          if (dbError) return res.status(400).json({ error: dbError.message });
          return res.json({ success: true });
        } catch (err) {
          return res.status(500).json({ error: 'Failed to change PIN' });
        }
      });

      // ---- Admin: change password (uses service_role, bypasses session checks) ----
      app.post('/api/admin/settings/change-password', async (req, res) => {
        try {
          const { user_id, new_password } = req.body;
          if (!user_id || !new_password) {
            return res.status(400).json({ error: 'user_id and new_password required' });
          }
          if (new_password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
          }
          const supabaseAdmin = getSupabaseAdmin(server, 'public');
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            password: new_password,
          });
          if (authError) return res.status(400).json({ error: authError.message });
          return res.json({ success: true });
        } catch (err) {
          return res.status(500).json({ error: 'Failed to change password' });
        }
      });

      // Mount Express app onto Vite's dev server
      server.middlewares.use(app);
    },
  };
}

