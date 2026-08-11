import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  resolveIdentity,
  isPublicPath,
  isSuperAdminUser,
  identityHasSchema,
  defaultSchemaFor,
  hashPin,
  verifyPin,
  signPosToken,
  isPosLoginThrottled,
  recordPosAttempt,
  requestIp,
  type Identity,
} from '../src/server/apiAuth.js';

function getSupabaseAdmin(schema?: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const serviceRole = process.env.SERVICE_ROLE || '';
  if (!supabaseUrl || !serviceRole) throw new Error('Missing Supabase admin credentials');
  const opts: any = { auth: { autoRefreshToken: false, persistSession: false } };
  if (schema) opts.db = { schema };
  return createClient(supabaseUrl, serviceRole, opts);
}

function mergeTenantSchema(meta: any, schema: string) {
  const current = Array.isArray(meta?.tenant_schemas)
    ? (meta.tenant_schemas as string[])
    : meta?.tenant_schema
      ? [meta.tenant_schema]
      : [];
  return {
    ...(meta || {}),
    tenant_schemas: [...new Set([...current, schema])],
    tenant_schema: meta?.tenant_schema || schema,
  };
}

function emailConflictResponse(res: VercelResponse, existing: any) {
  return res.status(409).json({
    error: 'EMAIL_EXISTS',
    message: 'This email is already registered to another user',
    existingUser: {
      id: existing.id,
      email: existing.email,
      full_name: existing.user_metadata?.full_name || '',
      tenant_schema: existing.user_metadata?.tenant_schema || null,
      confirmed_at: existing.confirmed_at || null,
      last_sign_in_at: existing.last_sign_in_at || null,
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let supabaseAdmin;
  let identity: Identity | null = null;
  const rawPath = req.query.path;
  let path: string[] = [];
  if (Array.isArray(rawPath)) path = rawPath.map(String);
  else if (typeof rawPath === 'string') path = rawPath.split('/').filter(Boolean);
  const method = req.method || 'GET';
  const body = req.body || {};

  try {
    const env = {
      supabaseUrl: process.env.VITE_SUPABASE_URL || '',
      serviceRole: process.env.SERVICE_ROLE || '',
      anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    };

    // ---- Auth guard (public allowlist bypasses) ----
    if (!isPublicPath(method, path.join('/'))) {
      identity = await resolveIdentity(req, env);
      if (!identity) {
        return res.status(401).json({ error: 'Unauthorized — missing or invalid session' });
      }
      if (path[0] === 'admin') {
        const posListing =
          identity.kind === 'pos' &&
          identity.payload.role === 'super_admin' &&
          method === 'GET' &&
          (path.join('/') === 'admin/tenants' || path.join('/') === 'admin/stores');
        if (identity.kind !== 'jwt' && !posListing) {
          return res.status(403).json({ error: 'Super admin session required' });
        }
        if (identity.kind === 'jwt') {
          const isAdmin = await isSuperAdminUser(env, identity.user.id);
          if (!isAdmin) {
            return res.status(403).json({ error: 'Super admin session required' });
          }
        }
      }
    }

    let schema = path[0] === 'admin' ? 'public' : ((req.query.tenant_schema as string) || (req.body?.tenant_schema as string) || '');
    if (path[0] !== 'admin' && !isPublicPath(method, path.join('/'))) {
      if (schema) {
        if (identity && !identityHasSchema(identity, schema)) {
          return res.status(403).json({ error: 'Not a member of this tenant' });
        }
      } else {
        schema = defaultSchemaFor(identity!) || '';
        if (!schema) {
          return res.status(400).json({ error: 'tenant_schema is required' });
        }
      }
    }
    supabaseAdmin = getSupabaseAdmin(schema || undefined);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }

  try {
    // PLU Categories
    if (path[0] === 'plu_categories') {
      if (path[1] === 'create' && method === 'POST') {
        const { name, created_by } = body;
        const { data, error } = await supabaseAdmin.from('plu_categories').insert({ name, created_by }).select().single();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, category: data });
      }
      if (path[1] && method === 'PUT') {
        const { error } = await supabaseAdmin.from('plu_categories').update({ name: body.name }).eq('category_id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
      if (path[1] && method === 'DELETE') {
        const { count } = await supabaseAdmin.from('plu').select('plu_id', { count: 'exact', head: true }).eq('category_id', path[1]);
        if ((count ?? 0) > 0) return res.status(400).json({ error: 'Cannot delete — category is assigned to PLUs.' });
        const { error } = await supabaseAdmin.from('plu_categories').delete().eq('category_id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
    }

    // Item Sizing
    if (path[0] === 'item-sizing') {
      if (method === 'GET') {
        const { data, error } = await supabaseAdmin.from('item_sizing').select('*').order('unit_type').order('packs_per_case');
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
      }
      if (path[1] === 'create' && method === 'POST') {
        const { unit_type, units_per_pack, packs_per_case } = body;
        const payload: Record<string, unknown> = { unit_type, packs_per_case };
        if (unit_type === 'each') {
          payload.units_per_pack = Math.floor(Number(units_per_pack));
          payload.packs_per_case = Math.floor(Number(packs_per_case));
        } else {
          payload.units_per_pack = Number(units_per_pack);
          payload.packs_per_case = Number(packs_per_case);
        }
        const { data, error } = await supabaseAdmin.from('item_sizing').insert(payload).select().single();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, item: data });
      }
      if (path[1] && method === 'PUT') {
        const { unit_type, units_per_pack, packs_per_case } = body;
        const payload: Record<string, unknown> = { unit_type, packs_per_case };
        if (unit_type === 'each') {
          payload.units_per_pack = Math.floor(Number(units_per_pack));
          payload.packs_per_case = Math.floor(Number(packs_per_case));
        } else {
          payload.units_per_pack = Number(units_per_pack);
          payload.packs_per_case = Number(packs_per_case);
        }
        const { error } = await supabaseAdmin.from('item_sizing').update(payload).eq('id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
      if (path[1] && method === 'DELETE') {
        const { error } = await supabaseAdmin.from('item_sizing').delete().eq('id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
    }

    // PLU Scheduled Changes
    if (path[0] === 'plu_scheduled_changes') {
      if (method === 'POST') {
        const { plu_id, payload, scheduled_at, created_by } = body;
        const { data, error } = await supabaseAdmin.from('plu_scheduled_changes').insert({ plu_id, payload, scheduled_at, created_by }).select().single();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, scheduled_change: data });
      }
      if (path[1] === 'due' && method === 'GET') {
        const { data, error } = await supabaseAdmin.from('plu_scheduled_changes').select('*').lte('scheduled_at', new Date().toISOString()).is('applied_at', null);
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
      }
      if (path[1] && path[2] === 'applied' && method === 'PUT') {
        const { error } = await supabaseAdmin.from('plu_scheduled_changes').update({ applied_at: new Date().toISOString() }).eq('id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
    }

    // PLU
    if (path[0] === 'plu') {
      if (path[1] === 'create' && method === 'POST') {
        const { name, plu_number, headoffice_price, category_id, ...rest } = body;
        const { count } = await supabaseAdmin.from('plu').select('plu_id', { count: 'exact', head: true }).eq('plu_number', plu_number);
        if ((count ?? 0) > 0) return res.status(400).json({ error: `PLU number "${plu_number}" already exists.` });
        const { data, error } = await supabaseAdmin.from('plu').insert({ name, plu_number, headoffice_price, category_id, ...rest }).select('*, plu_categories(name)').single();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, plu: data });
      }
      if (path[1] === 'ean' && path[2] && method === 'GET') {
        const { data, error } = await supabaseAdmin.from('plu').select('*').eq('ean', path[2]).maybeSingle();
        if (error) return res.status(400).json({ error: error.message });
        if (!data) return res.status(404).json({ error: 'Not found' });
        return res.json(data);
      }
      if (path[1] && method === 'PUT') {
        const { data: oldPlu } = await supabaseAdmin.from('plu').select('*').eq('plu_id', path[1]).single();
        const username = body.username || 'system';
        const { username: _u, ...updateData } = body;
        if (updateData.plu_number) {
          const { count } = await supabaseAdmin.from('plu').select('plu_id', { count: 'exact', head: true }).eq('plu_number', updateData.plu_number).neq('plu_id', path[1]);
          if ((count ?? 0) > 0) return res.status(400).json({ error: `PLU number "${updateData.plu_number}" already exists.` });
        }
        const { error } = await supabaseAdmin.from('plu').update(updateData).eq('plu_id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        if (oldPlu) {
          for (const key of Object.keys(updateData).filter((k) => oldPlu[k] !== updateData[k])) {
            await supabaseAdmin.from('logbook').insert({ entity: 'PLU', entity_label: `${oldPlu.plu_number}, ${oldPlu.name}`, field: key, old_value: oldPlu[key] ?? '', new_value: updateData[key] ?? '', username });
          }
        }
        return res.json({ success: true });
      }
      if (path[1] && method === 'DELETE') {
        const { error } = await supabaseAdmin.from('plu').delete().eq('plu_id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
    }

    // Users
    if (path[0] === 'users') {
      if (method === 'GET') {
        const { data, error } = await supabaseAdmin.from('users').select('user_id, email, username, full_name, role, is_active, requires_password_change, assigned_store_id, created_at, created_by, stores!assigned_store_id(name)').order('full_name');
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
      }
      if (path[1] === 'create' && method === 'POST') {
        const { email, username, full_name, role, pin, assigned_store_id, created_by } = body;
        if (!/^\d{4,8}$/.test(String(pin || ''))) {
          return res.status(400).json({ error: 'PIN must be 4-8 digits' });
        }
        const schema = (req.query.tenant_schema as string) || (body.tenant_schema as string);
        const authAdmin = getSupabaseAdmin();
        const { data: listData } = await authAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = (listData?.users || []).find((u: any) => u.email?.toLowerCase() === String(email).toLowerCase());

        let authUserId: string;
        let linked = false;
        let invited = false;
        const inviteOptions: any = {
          data: { tenant_schemas: [schema], tenant_schema: schema, full_name: full_name || '' },
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
          const mergedSchemas = [...new Set([...currentSchemas, schema])];
          const { error: metaError } = await authAdmin.auth.admin.updateUserById(authUserId, {
            user_metadata: {
              ...existingMeta,
              tenant_schemas: mergedSchemas,
              tenant_schema: existingMeta.tenant_schema || schema,
            },
          });
          if (metaError) return res.status(400).json({ error: metaError.message });
          if (!existing.confirmed_at) {
            const { error: inviteError } = await authAdmin.auth.admin.inviteUserByEmail(email, inviteOptions);
            if (inviteError) return res.status(400).json({ error: inviteError.message });
            invited = true;
          }
        } else {
          const { data: inviteData, error: inviteError } = await authAdmin.auth.admin.inviteUserByEmail(email, inviteOptions);
          if (inviteError) return res.status(400).json({ error: inviteError.message });
          if (!inviteData?.user) return res.status(400).json({ error: 'Failed to create auth user.' });
          authUserId = inviteData.user.id;
          invited = true;
        }

        const { data: existingRow } = await supabaseAdmin.from('users').select('user_id').eq('user_id', authUserId).maybeSingle();
        if (existingRow) return res.status(409).json({ error: 'User is already a member of this tenant' });

        const pinHash = hashPin(pin);
        const { error: profileError } = await supabaseAdmin.from('users').insert({
          user_id: authUserId, email, username, full_name, role,
          pin_hash: pinHash, is_active: true, assigned_store_id: assigned_store_id || null,
          created_by: created_by || null,
        });
        if (profileError) {
          if (!linked) await authAdmin.auth.admin.deleteUser(authUserId);
          return res.status(400).json({ error: profileError.message });
        }
        return res.json({ success: true, user_id: authUserId, linked, invited });
      }
      if (path[1] && method === 'PUT' && path[2] !== 'reset-password' && path[2] !== 'resend-invite') {
        const { email, password, username, full_name, role, is_active, assigned_store_id, pin } = body;
        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (password) authUpdates.password = password;
        if (Object.keys(authUpdates).length > 0) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(path[1], authUpdates);
          if (authError) return res.status(400).json({ error: authError.message });
        }
        const pinUpdate = pin ? { pin_hash: hashPin(String(pin)) } : {};
        const profileUpdate: any = { email, username, full_name, role, is_active, ...pinUpdate };
        if ('assigned_store_id' in body) profileUpdate.assigned_store_id = assigned_store_id || null;
        const { error: profileError } = await supabaseAdmin.from('users').update(profileUpdate).eq('user_id', path[1]);
        if (profileError) return res.status(400).json({ error: profileError.message });
        return res.json({ success: true });
      }
      if (path[1] && method === 'DELETE') {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
      if (path[1] && path[2] === 'reset-password' && method === 'PUT') {
        const { newPassword } = body;
        if (!newPassword || String(newPassword).length < 8) {
          return res.status(400).json({ error: 'newPassword is required (min 8 characters)' });
        }
        const { error } = await supabaseAdmin.auth.admin.updateUserById(path[1], { password: String(newPassword) });
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
      if (path[1] && path[2] === 'resend-invite' && method === 'PUT') {
        const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(path[1]);
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

        const anon = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
        const { error: resetError } = await anon.auth.resetPasswordForEmail(email, {
          redirectTo: process.env.APP_URL || req.headers.origin || undefined,
        });
        if (resetError) return res.status(400).json({ error: resetError.message });
        return res.json({ success: true, method: 'recovery' });
      }
    }

    // Logbook
    if (path[0] === 'logbook') {
      if (method === 'GET') {
        const { data, error } = await supabaseAdmin.from('logbook').select('*').order('timestamp', { ascending: false }).limit(1000);
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
      }
      if (path[1] === 'create' && method === 'POST') {
        const { entity, entityLabel, field, oldValue, newValue, username, action } = body;
        const insertData: Record<string, unknown> = { entity, entity_label: entityLabel, field, old_value: oldValue, new_value: newValue, username };
        if (action) insertData.action = action;
        const { error } = await supabaseAdmin.from('logbook').insert(insertData);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
    }

    // Suppliers
    if (path[0] === 'suppliers') {
      if (method === 'GET') {
        const { data, error } = await supabaseAdmin.from('suppliers').select('*').order('name');
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
      }
      if (path[1] === 'create' && method === 'POST') {
        const { username: _supplierUsername, name, contact_email, phone, address, payment_terms, vat_number, company_reg_number, bank_details } = body;
        const { data, error } = await supabaseAdmin.from('suppliers').insert({ name, contact_email, phone, address, payment_terms, vat_number, company_reg_number, bank_details }).select().single();
        if (error) return res.status(400).json({ error: error.message });
        const username = body.username || 'system';
        await supabaseAdmin.from('logbook').insert({ entity: 'Supplier', entity_label: name, field: '[CREATED]', old_value: '', new_value: `Supplier created with email: ${contact_email}`, username });
        return res.json({ success: true, supplier: data });
      }
      if (path[1] && method === 'PUT') {
        const { data: oldSupplier } = await supabaseAdmin.from('suppliers').select('*').eq('supplier_id', path[1]).single();
        const { username: _supplierUsername, ...updates } = body;
        const username = body.username || 'system';
        const { data, error } = await supabaseAdmin.from('suppliers').update(updates).eq('supplier_id', path[1]).select().single();
        if (error) return res.status(400).json({ error: error.message });
        if (oldSupplier) {
          for (const key of Object.keys(updates)) {
            if (JSON.stringify(oldSupplier[key]) !== JSON.stringify(updates[key])) {
              await supabaseAdmin.from('logbook').insert({ entity: 'Supplier', entity_label: oldSupplier.name, field: key, old_value: String(oldSupplier[key] || ''), new_value: String(updates[key] || ''), username });
            }
          }
        }
        return res.json({ success: true, supplier: data });
      }
    }

    // Purchase Orders
    if (path[0] === 'purchase-orders') {
      if (method === 'GET') {
        const { data, error } = await supabaseAdmin.from('purchase_orders').select('*, suppliers(name), stores(name), purchase_order_items(*, plu(name, plu_number))').order('created_at', { ascending: false });
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
      }
      if (path[1] === 'save-draft' && method === 'POST') {
        const { supplier_id, store_id, items, created_by } = body;
        let { data: po } = await supabaseAdmin.from('purchase_orders').select('*').eq('supplier_id', supplier_id).eq('store_id', store_id).eq('status', 'draft').maybeSingle();
        if (!po) {
          const now = new Date();
          const year = now.getFullYear();
          const ts = String(Date.now()).slice(-6);
          const po_number = `PO-${year}-${ts}`;
          const { data: newPo, error: createError } = await supabaseAdmin.from('purchase_orders').insert({ po_number, supplier_id, store_id, status: 'draft', created_by }).select().single();
          if (createError) return res.status(400).json({ error: createError.message });
          po = newPo;
          const { data: supplierName } = await supabaseAdmin.from('suppliers').select('name').eq('supplier_id', supplier_id).single();
          await supabaseAdmin.from('logbook').insert({ entity: 'Purchase Order', entity_label: po_number, field: 'status', old_value: '', new_value: `Draft Created (Supplier: ${supplierName?.name || 'Unknown'})`, username: 'system' });
        }
        let totalCost = 0;
        for (const item of items) {
          const cost = Number(item.cost_price_at_order || 0);
          totalCost += cost * Number(item.quantity_ordered);
          const { data: existingItem } = await supabaseAdmin.from('purchase_order_items').select('*').eq('po_id', po.po_id).eq('plu_id', item.plu_id).maybeSingle();
          if (existingItem) {
            await supabaseAdmin.from('purchase_order_items').update({ quantity_ordered: existingItem.quantity_ordered + Number(item.quantity_ordered) }).eq('po_item_id', existingItem.po_item_id);
          } else {
            await supabaseAdmin.from('purchase_order_items').insert({ po_id: po.po_id, plu_id: item.plu_id, quantity_ordered: Number(item.quantity_ordered), cost_price_at_order: cost });
          }
        }
        const { data: finalPo } = await supabaseAdmin.from('purchase_orders').update({ total_cost: totalCost }).eq('po_id', po.po_id).select('*, suppliers(name), stores(name), purchase_order_items(*, plu(name, plu_number))').single();
        return res.json({ success: true, purchase_order: finalPo });
      }
      if (path[1] && path[2] === 'lock' && method === 'PUT') {
        const { data: poDetails } = await supabaseAdmin.from('purchase_orders').select('po_number').eq('po_id', path[1]).single();
        const { error } = await supabaseAdmin.from('purchase_orders').update({ status: 'ordered', downloaded_at: new Date().toISOString() }).eq('po_id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        if (poDetails) {
          await supabaseAdmin.from('logbook').insert({ entity: 'Purchase Order', entity_label: poDetails.po_number, field: 'status', old_value: 'draft', new_value: 'ordered (Locked & PDF Downloaded)', username: 'system' });
        }
        return res.json({ success: true });
      }
    }

    // Supplier Products
    if (path[0] === 'supplier-products') {
      // GET: list with PLU details
      if (method === 'GET') {
        const supplier_id = typeof req.query.supplier_id === 'string' ? req.query.supplier_id : null;
        let query = supabaseAdmin.from('supplier_products').select('*, plu(plu_id, plu_number, name)');
        if (supplier_id) query = query.eq('supplier_id', supplier_id);
        const { data, error } = await query;
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
      }
      // DELETE: remove link
      if (path[1] && method === 'DELETE') {
        const { error } = await supabaseAdmin.from('supplier_products').delete().eq('supplier_product_id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
      // POST: link/upsert
      if (path[1] === 'link' && method === 'POST') {
        const { supplier_id, plu_id, supplier_sku, cost_price, is_preferred, lead_time_days } = body;
        const { data, error } = await supabaseAdmin.from('supplier_products').upsert({ supplier_id, plu_id, supplier_sku, cost_price, is_preferred, lead_time_days }, { onConflict: 'supplier_id,plu_id' }).select().single();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, supplier_product: data });
      }
    }

    // Purchase Orders: auto-suggest
    if (path[0] === 'purchase-orders' && path[1] === 'suggestions' && method === 'POST') {
      const { store_id } = body;
      if (!store_id) return res.status(400).json({ error: 'store_id is required' });

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000).toISOString();

      const { data: store } = await supabaseAdmin.from('stores').select('name').eq('store_id', store_id).single();
      const storeName = store?.name || 'Unknown';

      const { data: supplierProducts, error: spError } = await supabaseAdmin
        .from('supplier_products')
        .select('*, plu(plu_id, plu_number, name), suppliers!inner(supplier_id, name)')
        .eq('is_preferred', true);

      if (spError) return res.status(400).json({ error: spError.message });

      if (!supplierProducts || supplierProducts.length === 0) {
        return res.json({ suggestions: [] });
      }

      const { data: salesData } = await supabaseAdmin
        .from('sale_items')
        .select('plu_id, quantity, sales_transactions!inner(store_id, created_at)')
        .gte('sales_transactions.created_at', sevenDaysAgo)
        .eq('sales_transactions.store_id', store_id);

      const salesMap = new Map<string, number>();
      if (salesData) {
        for (const si of salesData) {
          const curr = salesMap.get(si.plu_id) ?? 0;
          salesMap.set(si.plu_id, curr + Number(si.quantity));
        }
      }

      const { data: receiptData } = await supabaseAdmin
        .from('purchase_order_items')
        .select('plu_id, quantity_received, purchase_orders!inner(store_id, received_at, status)')
        .in('purchase_orders.status', ['received', 'partially_received'])
        .gte('purchase_orders.received_at', eightWeeksAgo)
        .eq('purchase_orders.store_id', store_id);

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

      const supplierGroups = new Map<string, { supplier_id: string; supplier_name: string; items: any[]; total_cost: number }>();

      for (const sp of supplierProducts) {
        const plu = (sp as any).plu;
        const supplier = (sp as any).suppliers;
        if (!plu || !supplier) continue;

        const totalSales7d = salesMap.get(sp.plu_id) ?? 0;
        const avgDailySales = totalSales7d / 7;
        const receiptAgg = receiptMap.get(sp.plu_id);
        const avgReceipt8wk = receiptAgg ? receiptAgg.total / receiptAgg.count : 0;

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
    }

    // Stores: list active stores (for POS store selection)
    if (path[0] === 'stores' && method === 'GET') {
      let schema = (req.query.tenant_schema as string) || '';
      const slug = (req.query.tenant_slug as string) || '';
      if (!schema && slug) {
        const pub = getSupabaseAdmin();
        const { data: tenant } = await pub.from('tenants').select('schema_name').eq('slug', slug).maybeSingle();
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        schema = tenant.schema_name;
      }
      if (!schema) return res.status(400).json({ error: 'tenant_schema or tenant_slug required' });
      const client = getSupabaseAdmin(schema);
      const { data, error } = await client.from('stores').select('*').eq('is_active', true).order('name');
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    // POS: PIN Login (salted verify + self-migration, rate-limited, HMAC session token)
    if (path[0] === 'pos' && path[1] === 'login' && method === 'POST') {
      const { pin } = body;
      if (!/^\d{4,8}$/.test(String(pin || ''))) {
        return res.status(400).json({ error: 'PIN must be 4-8 digits' });
      }
      const schema = (req.query.tenant_schema as string) || (body.tenant_schema as string) || '';
      if (!schema) {
        return res.status(400).json({ error: 'tenant_schema is required' });
      }
      const env = { supabaseUrl: process.env.VITE_SUPABASE_URL || '', serviceRole: process.env.SERVICE_ROLE || '', anonKey: '' };
      const identifier = `${schema}:${String(pin).length}`;
      if (await isPosLoginThrottled(env, identifier)) {
        return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
      }
      const tenantCheck = await getSupabaseAdmin('public').from('tenants').select('schema_name').eq('schema_name', schema).maybeSingle();
      if (!tenantCheck.data) {
        await recordPosAttempt(env, identifier, false, requestIp(req));
        return res.status(404).json({ error: 'Tenant not found' });
      }
      const tenantClient = getSupabaseAdmin(schema);
      const { data: users } = await tenantClient
        .from('users')
        .select('user_id, username, full_name, role, pin_hash, is_active, assigned_store_id, stores!assigned_store_id(name)')
        .eq('is_active', true);
      if (!users || users.length === 0) {
        await recordPosAttempt(env, identifier, false, requestIp(req));
        return res.status(401).json({ error: 'Invalid PIN' });
      }
      const user = users.find((u: any) => verifyPin(String(pin), u.pin_hash).ok);
      if (!user) {
        await recordPosAttempt(env, identifier, false, requestIp(req));
        return res.status(401).json({ error: 'Invalid PIN' });
      }
      const check = verifyPin(String(pin), user.pin_hash);
      if (check.upgradedHash) {
        await tenantClient.from('users').update({ pin_hash: check.upgradedHash }).eq('user_id', user.user_id);
      }
      const { data: authUser } = await tenantClient.auth.admin.getUserById(user.user_id);
      if (authUser?.user && !authUser.user.confirmed_at) {
        await recordPosAttempt(env, identifier, false, requestIp(req));
        return res.status(401).json({ error: 'Please verify your email before using the terminal' });
      }
      await recordPosAttempt(env, identifier, true, requestIp(req));
      const posToken = signPosToken(env, {
        uid: user.user_id,
        schema,
        store_id: user.assigned_store_id || undefined,
        role: user.role,
      });
      return res.json({
        user: {
          user_id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          assigned_store_id: user.assigned_store_id,
          assigned_store_name: (user.stores as any)?.name || null,
        },
        pos_token: posToken,
        expires_in: 43200,
      });
    }

    // POS: Admin PIN Login (checks super_users, accepts store_id from body; verify_only returns pending token)
    if (path[0] === 'pos' && path[1] === 'admin-login' && method === 'POST') {
      const { pin, store_id, store_name, tenant_schema, verify_only } = body;
      if (!/^\d{4,8}$/.test(String(pin || ''))) {
        return res.status(400).json({ error: 'PIN must be 4-8 digits' });
      }
      const env = { supabaseUrl: process.env.VITE_SUPABASE_URL || '', serviceRole: process.env.SERVICE_ROLE || '', anonKey: '' };
      const identifier = `admin:${String(pin).length}`;
      if (await isPosLoginThrottled(env, identifier)) {
        return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
      }
      const supabasePublic = getSupabaseAdmin('public');
      const { data: suList } = await supabasePublic
        .from('super_users')
        .select('super_user_id, email, full_name, pin_hash, role')
        .eq('is_active', true);
      const su = (suList || []).find((u: any) => verifyPin(String(pin), u.pin_hash).ok);
      if (!su) {
        await recordPosAttempt(env, identifier, false, requestIp(req));
        return res.status(401).json({ error: 'Invalid PIN' });
      }
      const check = verifyPin(String(pin), su.pin_hash);
      if (check.upgradedHash) {
        await supabasePublic.from('super_users').update({ pin_hash: check.upgradedHash }).eq('super_user_id', su.super_user_id);
      }
      await recordPosAttempt(env, identifier, true, requestIp(req));
      if (verify_only) {
        const pendingToken = signPosToken(env, {
          uid: su.super_user_id,
          schema: 'public',
          store_id: 'pending',
          role: 'super_admin',
        });
        return res.json({ verified: true, pending_token: pendingToken, user: { user_id: su.super_user_id, full_name: su.full_name, role: 'super_admin' } });
      }
      if (!store_id) {
        return res.status(400).json({ error: 'store_id required' });
      }
      if (!tenant_schema) {
        return res.status(400).json({ error: 'tenant_schema required' });
      }
      const posToken = signPosToken(env, {
        uid: su.super_user_id,
        schema: tenant_schema,
        store_id,
        role: 'super_admin',
      });
      return res.json({
        user: {
          user_id: su.super_user_id,
          username: su.email.split('@')[0],
          full_name: su.full_name,
          role: 'super_admin',
          assigned_store_id: store_id,
          assigned_store_name: store_name || null,
        },
        pos_token: posToken,
        expires_in: 43200,
      });
    }

    // POS: Admin finalize store selection (pending token → full token)
    if (path[0] === 'pos' && path[1] === 'admin-finalize' && method === 'POST') {
      const { tenant_schema, store_id, store_name } = body;
      if (!tenant_schema || !store_id) {
        return res.status(400).json({ error: 'tenant_schema and store_id required' });
      }
      if (!identity || identity.kind !== 'pos' || identity.payload.role !== 'super_admin' || identity.payload.store_id !== 'pending') {
        return res.status(403).json({ error: 'Verify your PIN first' });
      }
      const tenantAdmin = getSupabaseAdmin(tenant_schema);
      const { data: store } = await tenantAdmin.from('stores').select('store_id, name').eq('store_id', store_id).maybeSingle();
      if (!store) return res.status(400).json({ error: 'Store not found in this tenant' });
      const env = { supabaseUrl: process.env.VITE_SUPABASE_URL || '', serviceRole: process.env.SERVICE_ROLE || '', anonKey: '' };
      const posToken = signPosToken(env, {
        uid: identity.payload.uid,
        schema: tenant_schema,
        store_id,
        role: 'super_admin',
      });
      return res.json({
        user: {
          user_id: identity.payload.uid,
          full_name: null,
          role: 'super_admin',
          assigned_store_id: store_id,
          assigned_store_name: store_name || store.name,
        },
        pos_token: posToken,
        expires_in: 43200,
      });
    }

    // POS: Clock In (identity-bound)
    if (path[0] === 'pos' && path[1] === 'clock-in' && method === 'POST') {
      const { store_id, user_id } = body;
      if (!store_id || !user_id) return res.status(400).json({ error: 'store_id and user_id required' });
      if (identity?.kind === 'pos' && identity.payload.uid !== user_id) return res.status(403).json({ error: 'Cannot clock in as another user' });
      if (identity?.kind === 'jwt' && identity.user.id !== user_id) return res.status(403).json({ error: 'Cannot clock in as another user' });
      const { data: store } = await supabaseAdmin.from('stores').select('store_id').eq('store_id', store_id).maybeSingle();
      if (!store) return res.status(400).json({ error: 'Store not found in this tenant' });
      const { data, error } = await supabaseAdmin.from('staff_timesheets').insert({ store_id, user_id, clock_in: new Date().toISOString() }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true, timesheet: data });
    }

    // POS: Clock Out (identity-bound)
    if (path[0] === 'pos' && path[1] === 'clock-out' && method === 'PUT') {
      const { user_id } = body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });
      if (identity?.kind === 'pos' && identity.payload.uid !== user_id) return res.status(403).json({ error: 'Cannot clock out another user' });
      if (identity?.kind === 'jwt' && identity.user.id !== user_id) return res.status(403).json({ error: 'Cannot clock out another user' });
      const { data: open } = await supabaseAdmin.from('staff_timesheets').select('*').eq('user_id', user_id).is('clock_out', null).order('clock_in', { ascending: false }).limit(1).maybeSingle();
      if (!open) return res.status(400).json({ error: 'No open clock-in found' });
      const { data, error } = await supabaseAdmin.from('staff_timesheets').update({ clock_out: new Date().toISOString() }).eq('timesheet_id', open.timesheet_id).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true, timesheet: data });
    }

    // POS: Clock Status (identity-bound)
    if (path[0] === 'pos' && path[1] === 'clock-status' && method === 'GET') {
      const user_id = typeof req.query.user_id === 'string' ? req.query.user_id : null;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });
      if (identity?.kind === 'pos' && identity.payload.uid !== user_id) return res.status(403).json({ error: 'Cannot view another user' });
      if (identity?.kind === 'jwt' && identity.user.id !== user_id) return res.status(403).json({ error: 'Cannot view another user' });
      const { data, error } = await supabaseAdmin.from('staff_timesheets').select('*').eq('user_id', user_id).order('clock_in', { ascending: false }).limit(5);
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    // Checklists
    if (path[0] === 'checklists') {
      // GET: list templates
      if (method === 'GET' && !path[1]) {
        const store_id = typeof req.query.store_id === 'string' ? req.query.store_id : null;
        if (!store_id) return res.status(400).json({ error: 'store_id required' });
        let query = supabaseAdmin.from('store_checklists').select('*').eq('store_id', store_id).order('sort_order', { ascending: true });
        const type = typeof req.query.type === 'string' ? req.query.type : null;
        if (type) query = query.eq('type', type);
        const { data, error } = await query;
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
      }
      // POST: create task
      if (path[1] === 'create' && method === 'POST') {
        const { store_id, type, task_name, sort_order } = body;
        if (!store_id || !type || !task_name) return res.status(400).json({ error: 'store_id, type, and task_name required' });
        const { data, error } = await supabaseAdmin.from('store_checklists').insert({ store_id, type, task_name, sort_order: sort_order ?? 0 }).select().single();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, checklist: data });
      }
      // PUT: update task
      if (path[1] && method === 'PUT') {
        const { task_name, sort_order, type } = body;
        const updates: Record<string, unknown> = {};
        if (task_name !== undefined) updates.task_name = task_name;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        if (type !== undefined) updates.type = type;
        const { error } = await supabaseAdmin.from('store_checklists').update(updates).eq('checklist_id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
      // DELETE: delete task
      if (path[1] && method === 'DELETE') {
        const { error } = await supabaseAdmin.from('store_checklists').delete().eq('checklist_id', path[1]);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }
    }

    // Purchase Orders: pending (for Goods In)
    if (path[0] === 'purchase-orders' && path[1] === 'pending' && method === 'GET') {
      const store_id = typeof req.query.store_id === 'string' ? req.query.store_id : null;
      if (!store_id) return res.status(400).json({ error: 'store_id required' });
      const { data, error } = await supabaseAdmin.from('purchase_orders').select('*, suppliers(name), purchase_order_items(*, plu(name, plu_number))').eq('store_id', store_id).eq('status', 'ordered').order('created_at', { ascending: false });
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    // Purchase Orders: receive delivery (Goods In)
    if (path[0] === 'purchase-orders' && path[1] === 'receive' && method === 'POST') {
      const { po_id, items } = body;
      if (!po_id || !items?.length) return res.status(400).json({ error: 'po_id and items required' });
      const { data: po } = await supabaseAdmin.from('purchase_orders').select('store_id').eq('po_id', po_id).single();
      if (!po) return res.status(404).json({ error: 'PO not found' });
      for (const item of items) {
        const { plu_id, qty_received } = item;
        if (!plu_id || qty_received == null) continue;
        const { data: existingItem } = await supabaseAdmin.from('purchase_order_items').select('*').eq('po_id', po_id).eq('plu_id', plu_id).single();
        if (!existingItem) continue;
        const newQty = (existingItem.quantity_received || 0) + Number(qty_received);
        await supabaseAdmin.from('purchase_order_items').update({ quantity_received: newQty }).eq('po_item_id', existingItem.po_item_id);
        const { data: invItem } = await supabaseAdmin.from('inventory').select('product_id, stock_quantity').eq('store_id', po.store_id).eq('name', plu_id).maybeSingle();
        if (invItem) {
          await supabaseAdmin.from('inventory').update({ stock_quantity: (invItem.stock_quantity || 0) + Number(qty_received) }).eq('product_id', invItem.product_id);
        } else {
          const { data: _plu } = await supabaseAdmin.from('plu').select('name').eq('plu_id', plu_id).single();
          await supabaseAdmin.from('inventory').insert({ store_id: po.store_id, name: plu_id, stock_quantity: Number(qty_received), price: existingItem.cost_price_at_order });
        }
      }
      const { data: allItems } = await supabaseAdmin.from('purchase_order_items').select('quantity_ordered, quantity_received').eq('po_id', po_id);
      const allFullyReceived = allItems?.every((i) => i.quantity_received >= i.quantity_ordered);
      const anyReceived = allItems?.some((i) => i.quantity_received > 0);
      let newStatus = 'ordered';
      if (allFullyReceived) newStatus = 'received';
      else if (anyReceived) newStatus = 'partially_received';
      await supabaseAdmin.from('purchase_orders').update({ status: newStatus, received_at: new Date().toISOString() }).eq('po_id', po_id);
      return res.json({ success: true, status: newStatus });
    }

    // Settings: get currency
    if (path[0] === 'settings' && path[1] === 'currency' && method === 'GET') {
      const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'currency').single();
      return res.json(data?.value || { symbol: '£', code: 'GBP', notes: [50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] });
    }

    // Settings: update currency
    if (path[0] === 'settings' && path[1] === 'currency' && method === 'PUT') {
      const { error } = await supabaseAdmin.from('system_settings').update({ value: body, updated_at: new Date().toISOString() }).eq('key', 'currency');
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    }

    // Loyalty Cards: list
    if (path[0] === 'loyalty-cards' && method === 'GET' && !path[1]) {
      const { data, error } = await supabaseAdmin.from('loyalty_cards').select('*').order('customer_name');
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    // Loyalty Cards: create (public registration — rate-limited, no balance injection)
    if (path[0] === 'loyalty-cards' && path[1] === 'create' && method === 'POST') {
      const { customer_name, phone, email } = body;
      if (!customer_name) return res.status(400).json({ error: 'customer_name required' });
      let schema = (req.query.tenant_schema as string) || body.tenant_schema || '';
      const slug = body.tenant_slug || (req.query.tenant_slug as string) || '';
      if (!schema && slug) {
        const pub = getSupabaseAdmin();
        const { data: tenant } = await pub.from('tenants').select('schema_name').eq('slug', slug).maybeSingle();
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        schema = tenant.schema_name;
      }
      if (!schema) return res.status(400).json({ error: 'tenant_schema or tenant_slug required' });
      const env = { supabaseUrl: process.env.VITE_SUPABASE_URL || '', serviceRole: process.env.SERVICE_ROLE || '', anonKey: '' };
      const ipKey = `loyalty-create:${requestIp(req) || 'unknown'}`;
      if (await isPosLoginThrottled(env, ipKey)) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
      }
      const client = getSupabaseAdmin(schema);
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const { count } = await client.from('loyalty_cards').select('card_number', { count: 'exact', head: true })
        .like('card_number', `LC-${today}-%`);
      const seq = String((count ?? 0) + 1).padStart(4, '0');
      const card_number = `LC-${today}-${seq}`;
      const { data, error } = await client.from('loyalty_cards').insert({
        store_id: body.store_id || null, card_number, customer_name: customer_name.trim(),
        phone: phone || null, email: email || null, postcode: body.postcode || null,
        cashback_balance: 0,
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      await recordPosAttempt(env, ipKey, true, requestIp(req));
      return res.json({ success: true, card: data });
    }

    // Loyalty Cards: update
    if (path[0] === 'loyalty-cards' && path[1] && method === 'PUT') {
      const allowed = ['customer_name', 'phone', 'email', 'postcode', 'store_id', 'cashback_balance', 'is_active'];
      const updates: any = {};
      for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields to update' });
      const { data: existing } = await supabaseAdmin.from('loyalty_cards').select('card_id').eq('card_id', path[1]).maybeSingle();
      if (!existing) return res.status(404).json({ error: 'Card not found' });
      const { error } = await supabaseAdmin.from('loyalty_cards').update(updates).eq('card_id', path[1]);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    }

    // Loyalty Cards: lookup by number
    if (path[0] === 'loyalty-cards' && path[1] === 'lookup' && path[2] && method === 'GET') {
      const cleaned = path[2].replace(/^loyalty:/, '');
      const { data, error } = await supabaseAdmin.from('loyalty_cards').select('*').eq('card_number', cleaned).eq('is_active', true).single();
      if (error) return res.status(404).json({ error: 'Card not found' });
      return res.json(data);
    }

    // Sales: create (server-validated totals, payment allowlist, persisted cashback)
    if (path[0] === 'sales' && path[1] === 'create' && method === 'POST') {
      const { store_id, staff_user_id, items, total_amount, discount_amount, payment_method, payment_note, loyalty_card_id } = body;
      const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'contactless', 'transfer'];
      if (!store_id || !staff_user_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'store_id, staff_user_id, and items required' });
      }
      if (!items.every((i: any) => i && typeof i.plu_id === 'string' && typeof i.plu_name === 'string' && typeof i.quantity === 'number' && i.quantity > 0 && typeof i.unit_price === 'number')) {
        return res.status(400).json({ error: 'Invalid item payload' });
      }
      if (!PAYMENT_METHODS.includes(payment_method || 'cash')) {
        return res.status(400).json({ error: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}` });
      }
      const { data: store } = await supabaseAdmin.from('stores').select('store_id, store_number').eq('store_id', store_id).maybeSingle();
      if (!store) return res.status(400).json({ error: 'Store not found in this tenant' });
      const round2 = (n: number) => Math.round(n * 100) / 100;
      // Server-side price validation: every line must match the PLU's configured price
      const pluIds = [...new Set(items.map((i: any) => i.plu_id))];
      const { data: pluRows } = await supabaseAdmin.from('plu').select('*').in('plu_id', pluIds);
      const pluMap = new Map((pluRows ?? []).map((p: any) => [p.plu_id, p]));
      for (const item of items) {
        const plu = pluMap.get(item.plu_id);
        if (!plu) {
          return res.status(400).json({ error: `Unknown PLU: ${item.plu_name}` });
        }
        const storePrice = Number(plu[`store_${store.store_number}`] ?? 0);
        const expected = storePrice > 0 ? storePrice : Number(plu.headoffice_price ?? 0);
        if (round2(Number(item.unit_price)) !== round2(expected)) {
          return res.status(400).json({ error: `Price mismatch for ${item.plu_name}: expected ${expected}` });
        }
      }
      const { data: staff } = await supabaseAdmin.from('users')
        .select('user_id, role, is_active, assigned_store_id').eq('user_id', staff_user_id).maybeSingle();
      if (!staff || !staff.is_active) return res.status(401).json({ error: 'Invalid staff member' });
      if (staff.role !== 'super_admin' && staff.assigned_store_id !== store_id) {
        return res.status(403).json({ error: 'Staff member is not assigned to this store' });
      }
      // POS operator binding: staff tokens can only record their own sales
      if (identity?.kind === 'pos' && identity.payload.role !== 'super_admin' && identity.payload.uid !== staff_user_id) {
        return res.status(403).json({ error: 'Sale must be recorded against the signed-in staff member' });
      }
      const computedTotal = round2(items.reduce((sum: number, i: any) => sum + round2(i.quantity * i.unit_price), 0));
      const discount = Math.min(round2(Number(discount_amount) || 0), computedTotal);
      const total = round2(computedTotal - discount);
      if (Number(total_amount) !== total) {
        return res.status(400).json({ error: 'total_amount does not match computed total' });
      }
      if (discount > 0 && !loyalty_card_id) {
        return res.status(400).json({ error: 'Discount requires a loyalty card' });
      }
      const { data: settings } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'loyalty_cashback_percent').maybeSingle();
      const percent = settings?.value?.percent ?? 0;
      const cashbackEarned = loyalty_card_id && percent > 0 ? round2((total * percent) / 100) : 0;
      const { data: transaction, error: txErr } = await supabaseAdmin.from('sales_transactions').insert({
        store_id, staff_user_id, total_amount: total, discount_amount: discount,
        payment_method, payment_note: payment_note || null,
        loyalty_card_id: loyalty_card_id || null,
        cashback_percent: percent, cashback_earned: cashbackEarned,
        status: 'completed',
      }).select().single();
      if (txErr) return res.status(400).json({ error: txErr.message });
      const saleId = transaction.transaction_id;
      for (const item of items) {
        const { error: itemErr } = await supabaseAdmin.from('sale_items').insert({
          transaction_id: saleId, plu_id: item.plu_id, plu_name: item.plu_name, quantity: item.quantity,
          unit_price: item.unit_price, total_price: round2(item.quantity * item.unit_price),
        });
        if (itemErr) {
          console.error('Insert sale item error:', itemErr);
          continue;
        }
        const { data: invItem } = await supabaseAdmin.from('inventory')
          .select('product_id, stock_quantity').eq('store_id', store_id).eq('name', item.plu_name).maybeSingle();
        if (invItem) {
          const newQty = Math.max(0, (invItem.stock_quantity || 0) - item.quantity);
          await supabaseAdmin.from('inventory').update({ stock_quantity: newQty }).eq('product_id', invItem.product_id);
        }
      }
      if (loyalty_card_id && discount > 0) {
        const { data: card } = await supabaseAdmin.from('loyalty_cards').select('cashback_balance').eq('card_id', loyalty_card_id).single();
        if (card) {
          const newBalance = Math.max(0, (card.cashback_balance || 0) - discount);
          await supabaseAdmin.from('loyalty_cards').update({ cashback_balance: newBalance }).eq('card_id', loyalty_card_id);
        }
      }
      // Accrue loyalty cashback for this purchase (persisted percent/earned)
      if (loyalty_card_id && cashbackEarned > 0) {
        const { data: card } = await supabaseAdmin.from('loyalty_cards').select('cashback_balance').eq('card_id', loyalty_card_id).single();
        if (card) {
          await supabaseAdmin.from('loyalty_cards').update({ cashback_balance: (card.cashback_balance || 0) + cashbackEarned }).eq('card_id', loyalty_card_id);
        }
      }
      return res.json({
        success: true,
        transaction: {
          ...transaction,
          sale_items: items.map((i: any) => ({
            plu_id: i.plu_id,
            plu_name: i.plu_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: round2(i.quantity * i.unit_price),
          })),
        },
      });
    }

    // Sales: list
    if (path[0] === 'sales' && method === 'GET') {
      let query = supabaseAdmin.from('sales_transactions').select('*, sale_items(*)').order('created_at', { ascending: false });
      if (req.query.store_id) query = query.eq('store_id', req.query.store_id);
      if (req.query.date) {
        query = query.gte('created_at', `${req.query.date}T00:00:00Z`).lte('created_at', `${req.query.date}T23:59:59Z`);
      } else if (req.query.start_date || req.query.end_date) {
        if (req.query.start_date) query = query.gte('created_at', `${req.query.start_date}T00:00:00Z`);
        if (req.query.end_date) query = query.lte('created_at', `${req.query.end_date}T23:59:59Z`);
      }
      if (req.query.payment_method) query = query.eq('payment_method', req.query.payment_method);
      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    // Sales: void
    if (path[0] === 'sales' && path[1] === 'void' && method === 'POST') {
      const { transaction_id } = body;
      if (!transaction_id) return res.status(400).json({ error: 'transaction_id required' });
      const { data: tx } = await supabaseAdmin.from('sales_transactions').select('*').eq('transaction_id', transaction_id).single();
      if (!tx) return res.status(404).json({ error: 'Transaction not found' });
      if (tx.status === 'void') return res.status(400).json({ error: 'Already voided' });
      const { data: items } = await supabaseAdmin.from('sale_items').select('*').eq('transaction_id', transaction_id);
      if (items) {
        for (const item of items) {
          const { data: invItem } = await supabaseAdmin.from('inventory')
            .select('product_id, stock_quantity').eq('store_id', tx.store_id).eq('name', item.plu_name).maybeSingle();
          if (invItem) {
            await supabaseAdmin.from('inventory').update({ stock_quantity: (invItem.stock_quantity || 0) + item.quantity }).eq('product_id', invItem.product_id);
          }
        }
      }
      if (tx.loyalty_card_id && tx.discount_amount > 0) {
        const { data: card } = await supabaseAdmin.from('loyalty_cards').select('cashback_balance').eq('card_id', tx.loyalty_card_id).single();
        if (card) {
          await supabaseAdmin.from('loyalty_cards').update({ cashback_balance: (card.cashback_balance || 0) + tx.discount_amount }).eq('card_id', tx.loyalty_card_id);
        }
      }
      // Subtract cashback that was earned on this sale (persisted value; fall back to settings for legacy rows)
      if (tx.loyalty_card_id) {
        let earned = tx.cashback_earned ?? null;
        if (earned === null || earned === undefined) {
          const { data: settings } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'loyalty_cashback_percent').single();
          const percent = settings?.value?.percent ?? 0;
          earned = percent > 0 ? (tx.total_amount * percent) / 100 : 0;
        }
        if (earned > 0) {
          const { data: card } = await supabaseAdmin.from('loyalty_cards').select('cashback_balance').eq('card_id', tx.loyalty_card_id).single();
          if (card) {
            await supabaseAdmin.from('loyalty_cards').update({ cashback_balance: Math.max(0, (card.cashback_balance || 0) - earned) }).eq('card_id', tx.loyalty_card_id);
          }
        }
      }
      const { error } = await supabaseAdmin.from('sales_transactions').update({ status: 'void' }).eq('transaction_id', transaction_id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    }

    // Settings: cashback percent
    if (path[0] === 'settings' && path[1] === 'loyalty-cashback-percent' && method === 'GET') {
      const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'loyalty_cashback_percent').single();
      return res.json({ percent: data?.value?.percent ?? 5 });
    }

    if (path[0] === 'settings' && path[1] === 'loyalty-cashback-percent' && method === 'PUT') {
      const value = Number(body.percent);
      if (Number.isNaN(value) || value < 0 || value > 100) {
        return res.status(400).json({ error: 'percent must be a number between 0 and 100' });
      }
      await supabaseAdmin.from('system_settings').upsert({ key: 'loyalty_cashback_percent', value: { percent: value }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      return res.json({ success: true });
    }

    // Loyalty Notifications: list
    if (path[0] === 'loyalty-notifications' && method === 'GET' && !path[1]) {
      const { data, error } = await supabaseAdmin.from('loyalty_notifications').select('*').order('created_at', { ascending: false });
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    // Loyalty Notifications: create
    if (path[0] === 'loyalty-notifications' && path[1] === 'create' && method === 'POST') {
      const { title, body: messageBody, store_id } = body;
      if (!title || !messageBody) return res.status(400).json({ error: 'title and body required' });
      const { data, error } = await supabaseAdmin.from('loyalty_notifications').insert({
        title, body: messageBody, store_id: store_id || null,
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true, notification: data });
    }

    // Loyalty Notifications: send
    if (path[0] === 'loyalty-notifications' && path[2] === 'send' && method === 'POST') {
      const { error } = await supabaseAdmin.from('loyalty_notifications').update({ sent_at: new Date().toISOString() }).eq('notification_id', path[1]);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    }

    // Loyalty Notifications: unseen by store
    if (path[0] === 'loyalty-notifications' && path[1] === 'unseen' && method === 'GET') {
      if (!req.query.store_id) return res.status(400).json({ error: 'store_id required' });
      const storeId = req.query.store_id;
      const { data, error } = await supabaseAdmin.from('loyalty_notifications')
        .select('*')
        .or(`store_id.eq.${storeId},store_id.is.null`)
        .not('sent_at', 'is', null)
        .order('created_at', { ascending: false });
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    // ---- Admin: list tenants ----
    if (path[0] === 'admin' && path[1] === 'tenants' && path.length === 2 && method === 'GET') {
      const { data: tenants } = await supabaseAdmin.from('tenants').select('*').order('created_at', { ascending: false });
      const { data: subs } = await supabaseAdmin.from('tenant_subscriptions').select('*, plans(name)');
      const subMap = new Map((subs || []).map((s: any) => [s.tenant_id, s]));
      const enriched = (tenants || []).map((t: any) => ({
        ...t,
        plan_name: subMap.get(t.tenant_id)?.plans?.name || null,
        subscription_status: subMap.get(t.tenant_id)?.status || null,
      }));
      return res.json(enriched);
    }

    // ---- Admin: update tenant ----
    if (path[0] === 'admin' && path[1] === 'tenants' && path[2] && path.length === 3 && method === 'PUT') {
      const { data: existing } = await supabaseAdmin.from('tenants').select('tenant_id').eq('tenant_id', path[2]).maybeSingle();
      if (!existing) return res.status(404).json({ error: 'Tenant not found' });

      const update: Record<string, any> = {};
      if (body.name !== undefined) update.name = String(body.name).trim();
      if (body.domain !== undefined) update.domain = body.domain ? String(body.domain).trim() : null;
      if (body.is_active !== undefined) update.is_active = !!body.is_active;
      if (body.slug !== undefined) {
        const slug = String(body.slug).trim().toLowerCase();
        if (!/^[a-z0-9_-]+$/.test(slug)) {
          return res.status(400).json({ error: 'Slug can only contain lowercase letters, numbers, hyphens, and underscores' });
        }
        const { data: clash } = await supabaseAdmin.from('tenants').select('tenant_id').eq('slug', slug).neq('tenant_id', path[2]).maybeSingle();
        if (clash) return res.status(400).json({ error: 'Slug already in use by another tenant' });
        update.slug = slug;
      }
      if (body.plan_id !== undefined && body.plan_id) update.plan_id = body.plan_id;

      if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No fields to update' });

      const { error: updError } = await supabaseAdmin.from('tenants').update(update).eq('tenant_id', path[2]);
      if (updError) return res.status(400).json({ error: updError.message });

      if (update.plan_id) {
        const { data: sub } = await supabaseAdmin.from('tenant_subscriptions').select('subscription_id').eq('tenant_id', path[2]).maybeSingle();
        if (sub) {
          const { error: subError } = await supabaseAdmin.from('tenant_subscriptions')
            .update({ plan_id: update.plan_id, status: 'active', starts_at: new Date().toISOString() })
            .eq('subscription_id', sub.subscription_id);
          if (subError) return res.status(400).json({ error: subError.message });
        } else {
          const { error: subError } = await supabaseAdmin.from('tenant_subscriptions')
            .insert({ tenant_id: path[2], plan_id: update.plan_id, status: 'active' });
          if (subError) return res.status(400).json({ error: subError.message });
        }
      }
      return res.json({ success: true });
    }

    // ---- App: get current tenant info (by tenant_schema or slug) ----
    if (path[0] === 'app' && path[1] === 'tenant-info' && method === 'GET') {
      const schema = (req.query.tenant_schema as string) || '';
      const slug = (req.query.slug as string) || '';
      if (!schema && !slug) return res.status(400).json({ error: 'tenant_schema or slug required' });
      const pub = getSupabaseAdmin();
      let q = pub.from('tenants').select('tenant_id, name, slug, schema_name');
      if (schema) q = q.eq('schema_name', schema);
      else q = q.eq('slug', slug);
      const { data: tenant, error } = await q.maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      return res.json(tenant);
    }

    // ---- Public: list active tenants (for loyalty registration) ----
    if (path[0] === 'public' && path[1] === 'tenants' && method === 'GET') {
      const { data, error } = await supabaseAdmin.from('tenants')
        .select('tenant_id, name, slug')
        .eq('is_active', true)
        .order('name');
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    }

    // ---- Admin: invite tenant main user (when none exists) ----
    if (path[0] === 'admin' && path[1] === 'tenants' && path[2] && path.length === 4 && path[3] === 'main-user' && method === 'POST') {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('tenant_id', path[2]).maybeSingle();
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      const { email, full_name } = body;
      if (!email || !full_name) return res.status(400).json({ error: 'email and full_name required' });

      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = (authUsers?.users || []).find((u: any) => u.user_metadata?.tenant_schema === tenant.schema_name);
      if (existing) return res.status(400).json({ error: 'This tenant already has a main user' });

      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { ...mergeTenantSchema({}, tenant.schema_name), is_tenant_admin: true, full_name },
        redirectTo: process.env.APP_URL || req.headers.origin || undefined,
      });
      if (inviteError) return res.status(400).json({ error: inviteError.message });

      let warning: string | null = null;
      try {
        const tenantAdmin = getSupabaseAdmin(tenant.schema_name);
        const { error: dbError } = await tenantAdmin.from('users').insert({
          user_id: inviteData?.user?.id,
          username: email.split('@')[0],
          email,
          full_name,
          role: 'super_user',
          is_active: true,
        });
        if (dbError) warning = `Invite sent, but tenant profile could not be created: ${dbError.message}`;
      } catch (e) {
        warning = `Invite sent, but tenant profile could not be created: ${(e as Error).message}`;
      }
      return res.json({ success: true, user_id: inviteData?.user?.id, ...(warning ? { warning } : {}) });
    }

    // ---- Admin: get tenant main user ----
    if (path[0] === 'admin' && path[1] === 'tenants' && path[2] && path.length === 4 && path[3] === 'main-user' && method === 'GET') {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('tenant_id', path[2]).maybeSingle();
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      let dbRow: any = null;
      try {
        const tenantAdmin = getSupabaseAdmin(tenant.schema_name);
        const { data, error } = await tenantAdmin.from('users')
          .select('user_id, email, username, full_name, role, is_active, requires_password_change')
          .eq('role', 'super_user').order('created_at', { ascending: true }).limit(1).maybeSingle();
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
    }

    // ---- Admin: update tenant main user ----
    if (path[0] === 'admin' && path[1] === 'tenants' && path[2] && path.length === 4 && path[3] === 'main-user' && method === 'PUT') {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('schema_name').eq('tenant_id', path[2]).maybeSingle();
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      const { user_id, full_name, username, email, is_active } = body;
      if (!user_id || !full_name || !username || !email) {
        return res.status(400).json({ error: 'user_id, full_name, username, and email required' });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
        return res.status(400).json({ error: 'Invalid user_id' });
      }

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (!authUser?.user) return res.status(404).json({ error: 'Auth user not found' });

      // Proactively detect email conflicts before calling updateUserById:
      // GoTrue can return a generic "Error updating user" message on conflicts,
      // so check the target email up front for a deterministic result.
      const emailChanged = email.toLowerCase() !== (authUser.user.email || '').toLowerCase();
      if (emailChanged) {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const conflicting = (authUsers?.users || []).find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase() && u.id !== user_id,
        );
        if (conflicting) return emailConflictResponse(res, conflicting);
      }

      const authUpdate: any = { user_metadata: { ...(authUser.user.user_metadata || {}), full_name } };
      if (emailChanged) authUpdate.email = email;
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate);
      if (authError) {
        // Fallback: if the update failed while changing the email, re-check for
        // a conflict (the error message may not clearly indicate one).
        if (emailChanged) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const conflicting = (authUsers?.users || []).find(
            (u: any) => u.email?.toLowerCase() === email.toLowerCase() && u.id !== user_id,
          );
          if (conflicting) return emailConflictResponse(res, conflicting);
        }
        return res.status(400).json({ error: authError.message });
      }

      let warning: string | null = null;
      try {
        const tenantAdmin = getSupabaseAdmin(tenant.schema_name);
        const { error: dbError } = await tenantAdmin.from('users')
          .update({ full_name, username, email, is_active: !!is_active })
          .eq('user_id', user_id);
        if (dbError) warning = `Auth user updated, but tenant profile could not be updated: ${dbError.message}`;
      } catch (e) {
        warning = `Auth user updated, but tenant profile could not be updated: ${(e as Error).message}`;
      }
      return res.json({ success: true, ...(warning ? { warning } : {}) });
    }

    // ---- Admin: reassign main user to an existing auth user ----
    if (path[0] === 'admin' && path[1] === 'tenants' && path[2] && path[3] === 'main-user' && path[4] === 'reassign' && method === 'POST') {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('schema_name').eq('tenant_id', path[2]).maybeSingle();
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      const { existing_user_id } = body;
      if (!existing_user_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing_user_id)) {
        return res.status(400).json({ error: 'existing_user_id (UUID) required' });
      }

      // Get the existing auth user
      const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(existing_user_id);
      if (getUserError || !existingUser?.user) return res.status(404).json({ error: 'Existing user not found' });

      const user = existingUser.user;
      const oldTenantSchema = user.user_metadata?.tenant_schema;

      // Update the existing user's metadata to point to this tenant
      const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(existing_user_id, {
        user_metadata: {
          ...mergeTenantSchema(user.user_metadata || {}, tenant.schema_name),
          is_tenant_admin: true,
        },
      });
      if (updateMetaError) return res.status(400).json({ error: updateMetaError.message });

      // Deactivate the previous main user for this tenant (if different from the new one)
      if (oldTenantSchema && oldTenantSchema !== tenant.schema_name) {
        try {
          const oldTenantAdmin = getSupabaseAdmin(oldTenantSchema);
          await oldTenantAdmin.from('users')
            .update({ is_active: false })
            .eq('role', 'super_user');
        } catch {
          // old tenant schema may not exist or other error - ignore
        }
      }

      // Create/update the tenant profile for the new main user
      let warning: string | null = null;
      try {
        const tenantAdmin = getSupabaseAdmin(tenant.schema_name);
        const { error: dbError } = await tenantAdmin.from('users').upsert({
          user_id: existing_user_id,
          username: user.email?.split('@')[0] || 'user',
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          role: 'super_user',
          is_active: true,
        }, { onConflict: 'user_id' });
        if (dbError) warning = `Main user reassigned, but tenant profile could not be created/updated: ${dbError.message}`;
      } catch (e) {
        warning = `Main user reassigned, but tenant profile could not be created/updated: ${(e as Error).message}`;
      }

      // If user is unconfirmed, send invitation email
      if (!user.confirmed_at) {
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(user.email!, {
          data: { ...mergeTenantSchema({}, tenant.schema_name), is_tenant_admin: true },
          redirectTo: process.env.APP_URL || req.headers.origin || undefined,
        });
        if (inviteError) warning = (warning ? warning + '; ' : '') + `Invitation failed: ${inviteError.message}`;
      }

      return res.json({ success: true, user_id: existing_user_id, ...(warning ? { warning } : {}) });
    }

    // ---- Admin: resend tenant main user access email ----
    if (path[0] === 'admin' && path[1] === 'tenants' && path[2] && path[3] === 'main-user' && path[4] === 'resend-invite' && method === 'POST') {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('schema_name').eq('tenant_id', path[2]).maybeSingle();
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authUser = (authUsers?.users || []).find((u: any) => u.user_metadata?.tenant_schema === tenant.schema_name);
      if (!authUser) return res.status(404).json({ error: 'No main user found for this tenant' });

      if (!authUser.confirmed_at) {
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(authUser.email!, {
          data: { ...mergeTenantSchema({}, tenant.schema_name), is_tenant_admin: true },
          redirectTo: process.env.APP_URL || req.headers.origin || undefined,
        });
        if (inviteError) return res.status(400).json({ error: inviteError.message });
        return res.json({ success: true, method: 'invite' });
      }

      const anon = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
      const { error: resetError } = await anon.auth.resetPasswordForEmail(authUser.email!, {
        redirectTo: process.env.APP_URL || req.headers.origin || undefined,
      });
      if (resetError) return res.status(400).json({ error: resetError.message });
      return res.json({ success: true, method: 'recovery' });
    }

    // ---- Admin: reset tenant main user password ----
    if (path[0] === 'admin' && path[1] === 'tenants' && path[2] && path[3] === 'main-user' && path[4] === 'reset-password' && method === 'POST') {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) return res.status(400).json({ error: 'user_id and new_password required' });
      if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
        return res.status(400).json({ error: 'Invalid user_id' });
      }
      const { data: tenant } = await supabaseAdmin.from('tenants').select('schema_name').eq('tenant_id', path[2]).maybeSingle();
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
      if (authError) return res.status(400).json({ error: authError.message });

      let warning: string | null = null;
      try {
        const tenantAdmin = getSupabaseAdmin(tenant.schema_name);
        const { error: dbError } = await tenantAdmin.from('users')
          .update({ requires_password_change: true }).eq('user_id', user_id);
        if (dbError) warning = `Password updated, but force-change flag could not be set: ${dbError.message}`;
      } catch (e) {
        warning = `Password updated, but force-change flag could not be set: ${(e as Error).message}`;
      }
      return res.json({ success: true, ...(warning ? { warning } : {}) });
    }

    // ---- Admin: list stores for a given tenant schema ----
    if (path[0] === 'admin' && path[1] === 'stores' && method === 'GET') {
      const schema = (req.query as any).schema as string;
      if (!schema) return res.status(400).json({ error: 'schema query param required' });
      const tenantAdmin = getSupabaseAdmin(schema);
      const { data, error } = await tenantAdmin.from('stores').select('*').eq('is_active', true).order('name');
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    // ---- Admin: provision tenant ----
    if (path[0] === 'admin' && path[1] === 'provision-tenant' && method === 'POST') {
      const { name, slug, plan_id, admin_email, admin_name } = body;
      if (!name || !slug || !plan_id || !admin_email || !admin_name) {
        return res.status(400).json({ error: 'All fields required' });
      }
      const { data: tenantId, error: provisionError } = await supabaseAdmin.rpc('provision_tenant', {
        p_tenant_name: name, p_slug: slug, p_plan_id: plan_id,
      });
      if (provisionError) return res.status(400).json({ error: provisionError.message });
      const schemaName = `tenant_${tenantId?.toString().replace(/-/g, '')}`;
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(admin_email, {
        data: { ...mergeTenantSchema({}, schemaName), is_tenant_admin: true },
        redirectTo: process.env.APP_URL || req.headers.origin || undefined,
      });
      if (inviteError) {
        return res.json({ tenant_id: tenantId, warning: `Tenant created but invite failed: ${inviteError.message}` });
      }
      if (inviteData?.user) {
        const tenantAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SERVICE_ROLE || '', {
          auth: { autoRefreshToken: false, persistSession: false },
          db: { schema: schemaName },
        });
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
    }

    // ---- Admin: list super users (no pin_hash) ----
    if (path[0] === 'admin' && path[1] === 'super-users' && method === 'GET') {
      const { data, error } = await supabaseAdmin.from('super_users').select('super_user_id, email, full_name, role, is_active, created_at').order('created_at', { ascending: false });
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    // ---- Admin: invite super user ----
    if (path[0] === 'admin' && path[1] === 'super-users' && path[2] === 'invite' && method === 'POST') {
      const { email, full_name, role } = body;
      if (!email || !full_name || !role) {
        return res.status(400).json({ error: 'email, full_name, and role required' });
      }
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { is_super_admin: role === 'super_admin', is_support: role === 'support', full_name },
        redirectTo: process.env.APP_URL || req.headers.origin || undefined,
      });
      if (inviteError) return res.status(400).json({ error: inviteError.message });
      if (!inviteData?.user) return res.status(400).json({ error: 'Failed to create user' });
      const { error: insertError } = await supabaseAdmin.from('super_users').insert({
        super_user_id: inviteData.user.id, email, full_name, role, is_active: true,
      });
      if (insertError) return res.status(400).json({ error: insertError.message });
      return res.json({ success: true, super_user_id: inviteData.user.id });
    }

    // ---- Admin: list plans ----
    if (path[0] === 'admin' && path[1] === 'plans' && method === 'GET') {
      const { data, error } = await supabaseAdmin.from('plans').select('*').order('price');
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    // ---- Admin: change PIN (4-8 digits, salted hash, own row only) ----
    if (path[0] === 'admin' && path[1] === 'settings' && path[2] === 'change-pin' && method === 'POST') {
      const { user_id, pin } = body;
      if (!user_id || !pin) {
        return res.status(400).json({ error: 'user_id and pin required' });
      }
      if (!/^\d{4,8}$/.test(String(pin))) {
        return res.status(400).json({ error: 'PIN must be 4-8 digits' });
      }
      if (identity?.kind === 'jwt' && identity.user.id !== user_id) {
        return res.status(403).json({ error: 'You can only change your own PIN' });
      }
      const pinHash = hashPin(String(pin));
      const { error: dbError } = await supabaseAdmin.from('super_users').update({ pin_hash: pinHash }).eq('super_user_id', user_id);
      if (dbError) return res.status(400).json({ error: dbError.message });
      return res.json({ success: true });
    }

    // ---- Admin: change password (uses service_role, bypasses session checks) ----
    if (path[0] === 'admin' && path[1] === 'settings' && path[2] === 'change-password' && method === 'POST') {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) {
        return res.status(400).json({ error: 'user_id and new_password required' });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password,
      });
      if (authError) return res.status(400).json({ error: authError.message });
      return res.json({ success: true });
    }

    return res.status(404).json({ error: `Route not found: /api/${path.join('/')}` });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
