import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ---- env ----
const envText = readFileSync('.env', 'utf8');
const get = (k) => envText.split('\n').find((l) => l.startsWith(k + '='))?.split('=').slice(1).join('=').replace(/["']/g, '').trim() || '';
const URL = get('VITE_SUPABASE_URL');
const SR = get('SERVICE_ROLE');
const SCHEMA = 'tenant_231a006984ed4984bb126ae7fad947c0';
const API = process.env.API_BASE || 'http://localhost:5174/api';
const STORE = 'e17597bf-fccd-4723-8fbf-73edab4353f3';
const RIBEYE = '4614307c-77e8-4750-b2c6-fb7e19a6f9e7';
const RIBEYE_INV = '9e6c1071-3d62-4d7b-89b2-2f2ec2dd2557';
const SUPPLIER = '69c9e3eb-659f-42f3-b343-68e47a7c256b';
const STAFF = '7b54120d-897d-49ce-a14e-04b6aa125234';
const PIN = '123456';
const WRONG = '999999'; // genuinely wrong PIN (753159 is smoketest's real PIN -> would succeed)

const admin = createClient(URL, SR, { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: SCHEMA } });
const results = [];
function check(name, ok, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`); }
async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
  let body = null;
  try { body = await r.json(); } catch { }
  return { status: r.status, body };
}

async function main() {
  const target = process.env.TARGET || 'DEV';
  console.log(`\n===== PHASE 6 REGRESSION SMOKE (${target}) — ${new Date().toISOString()} =====\n`);

  // ---- D8: PIN throttle bucket isolation (value-hash, not length) ----
  // Wrong PIN = smoketest's 753159; 11 attempts -> 429. Same-length 123456 must still work.
  let statuses = [];
  for (let i = 0; i < 11; i++) {
    const r = await api('/pos/pin-login', { method: 'POST', body: JSON.stringify({ pin: WRONG }) });
    statuses.push(r.status);
  }
  check('D8-a: 11 wrong PIN attempts on 753159 -> at least one 429', statuses.some((s) => s === 429), `statuses=${statuses.join(',')}`);
  const ok = await api('/pos/pin-login', { method: 'POST', body: JSON.stringify({ pin: PIN }) });
  check('D8-b: 123456 (same 6-len, different value) still logs in 200', ok.status === 200 && ok.body.kind === 'user', `status=${ok.status}`);
  const again = await api('/pos/pin-login', { method: 'POST', body: JSON.stringify({ pin: WRONG }) });
  check('D8-c: further 753159 attempt stays 429', again.status === 429, `status=${again.status}`);
  const tok = ok.body.pos_token;
  check('D8-d: got POS token', !!tok);

  // ---- Weighted: fractional sale deducts exact 3dp ----
  const inv0 = await admin.from('inventory').select('stock_quantity').eq('product_id', RIBEYE_INV).single();
  const stockBefore = Number(inv0.data.stock_quantity);
  const total = Math.round(0.5 * 20.99 * 100) / 100; // 10.50
  const sale = await api('/sales/create', {
    method: 'POST', headers: { 'X-POS-Token': tok },
    body: JSON.stringify({
      store_id: STORE, staff_user_id: STAFF, pin: PIN,
      items: [{ plu_id: RIBEYE, plu_name: 'RIBEYE', quantity: 0.5, unit_price: 20.99 }],
      total_amount: total, discount_amount: 0, payment_method: 'cash', cash_given: 11,
    }),
  });
  check('W1: weighted cash sale 200', sale.status === 200, `status=${sale.status} err=${sale.body?.error || ''}`);
  check('W2: total 10.50 + change 0.50 computed server-side', sale.status === 200 && sale.body.transaction.total_amount === 10.5 && sale.body.transaction.change_due === 0.5, JSON.stringify({ t: sale.body?.transaction?.total_amount, c: sale.body?.transaction?.change_due }));
  const txId = sale.body?.transaction?.transaction_id;
  const inv1 = await admin.from('inventory').select('stock_quantity').eq('product_id', RIBEYE_INV).single();
  const expectedAfter = Math.round((stockBefore - 0.5) * 1000) / 1000;
  check('W3: stock decremented by exactly 0.500 (3dp)', Number(inv1.data.stock_quantity) === expectedAfter, `before=${stockBefore} after=${inv1.data.stock_quantity} expected=${expectedAfter}`);
  const tx = await admin.from('sales_transactions').select('*').eq('transaction_id', txId).single();
  check('W4: header persisted cash_given=11.00 change_due=0.50', Number(tx.data.cash_given) === 11 && Number(tx.data.change_due) === 0.5, JSON.stringify({ g: tx.data.cash_given, c: tx.data.change_due }));
  const items = await admin.from('sale_items').select('*').eq('transaction_id', txId);
  check('W5: sale_items row persisted qty 0.500', items.data?.length === 1 && Number(items.data[0].quantity) === 0.5, JSON.stringify(items.data));

  // ---- D7: cash validation matrix ----
  const short = await api('/sales/create', {
    method: 'POST', headers: { 'X-POS-Token': tok },
    body: JSON.stringify({
      store_id: STORE, staff_user_id: STAFF, pin: PIN,
      items: [{ plu_id: RIBEYE, plu_name: 'RIBEYE', quantity: 0.5, unit_price: 20.99 }],
      total_amount: total, discount_amount: 0, payment_method: 'cash', cash_given: 10,
    }),
  });
  check('D7-a: short change cash 400', short.status === 400, `status=${short.status} err=${short.body?.error || ''}`);
  const nocash = await api('/sales/create', {
    method: 'POST', headers: { 'X-POS-Token': tok },
    body: JSON.stringify({
      store_id: STORE, staff_user_id: STAFF, pin: PIN,
      items: [{ plu_id: RIBEYE, plu_name: 'RIBEYE', quantity: 0.5, unit_price: 20.99 }],
      total_amount: total, discount_amount: 0, payment_method: 'cash',
    }),
  });
  check('D7-b: missing cash_given on cash 400', nocash.status === 400, `status=${nocash.status} err=${nocash.body?.error || ''}`);
  const cardWithCash = await api('/sales/create', {
    method: 'POST', headers: { 'X-POS-Token': tok },
    body: JSON.stringify({
      store_id: STORE, staff_user_id: STAFF, pin: PIN,
      items: [{ plu_id: RIBEYE, plu_name: 'RIBEYE', quantity: 0.5, unit_price: 20.99 }],
      total_amount: total, discount_amount: 0, payment_method: 'card', cash_given: 11,
    }),
  });
  check('D7-c: cash_given on card 400', cardWithCash.status === 400, `status=${cardWithCash.status} err=${cardWithCash.body?.error || ''}`);

  // ---- Weighted: void restores exact stock ----
  const voidRes = await api('/sales/void', { method: 'POST', headers: { 'X-POS-Token': tok }, body: JSON.stringify({ transaction_id: txId }) });
  check('W6: void 200', voidRes.status === 200, `status=${voidRes.status}`);
  const inv2 = await admin.from('inventory').select('stock_quantity').eq('product_id', RIBEYE_INV).single();
  check('W7: stock restored after void', Number(inv2.data.stock_quantity) === stockBefore, `after=${inv2.data.stock_quantity} expected=${stockBefore}`);
  const txV = await admin.from('sales_transactions').select('status').eq('transaction_id', txId).single();
  check('W8: tx status=void', txV.data.status === 'void', txV.data.status);

  // ---- D6: PO business dates (backdate receive keeps audit timestamp) ----
  const draft = await api('/purchase-orders/save-draft', {
    method: 'POST', headers: { 'X-POS-Token': tok },
    body: JSON.stringify({
      supplier_id: SUPPLIER, store_id: STORE, created_by: STAFF,
      items: [{ plu_id: RIBEYE, quantity_ordered: 3, cost_price_at_order: 15 }],
      expected_delivery_date: '2026-08-20',
    }),
  });
  check('D6-a: save-draft 200 with expected_delivery_date', draft.status === 200, `status=${draft.status} err=${draft.body?.error || ''}`);
  const poId = draft.body?.purchase_order?.po_id;
  check('D6-b: draft persisted expected_delivery_date=2026-08-20', draft.body?.purchase_order?.expected_delivery_date === '2026-08-20', JSON.stringify(draft.body?.purchase_order?.expected_delivery_date));

  const lock = await api(`/purchase-orders/${poId}/lock`, { method: 'PUT', headers: { 'X-POS-Token': tok }, body: JSON.stringify({}) });
  check('D6-c: lock PO 200', lock.status === 200, `status=${lock.status} err=${lock.body?.error || ''}`);

  const backdated = await api('/purchase-orders/receive', {
    method: 'POST', headers: { 'X-POS-Token': tok },
    body: JSON.stringify({ po_id: poId, pin: PIN, delivered_date: '2026-08-12', items: [{ plu_id: RIBEYE, qty_received: 1.5 }] }),
  });
  check('D6-d: backdated receive 200', backdated.status === 200, `status=${backdated.status} err=${backdated.body?.error || ''}`);
  const poAfter = await admin.from('purchase_orders').select('delivered_date, received_at, status').eq('po_id', poId).single();
  check('D6-e: delivered_date=2026-08-12 business date', poAfter.data.delivered_date === '2026-08-12', JSON.stringify(poAfter.data.delivered_date));
  check('D6-f: received_at is REAL audit timestamp (today, not 2026-08-12)', poAfter.data.received_at && poAfter.data.received_at.slice(0, 10) === new Date().toISOString().slice(0, 10), poAfter.data.received_at);
  check('D6-g: PO status partially_received', poAfter.data.status === 'partially_received', poAfter.data.status);

  const future = await api('/purchase-orders/receive', {
    method: 'POST', headers: { 'X-POS-Token': tok },
    body: JSON.stringify({ po_id: poId, pin: PIN, delivered_date: '2099-01-01', items: [{ plu_id: RIBEYE, qty_received: 0.5 }] }),
  });
  check('D6-h: future delivered_date 400', future.status === 400, `status=${future.status} err=${future.body?.error || ''}`);

  const over = await api('/purchase-orders/receive', {
    method: 'POST', headers: { 'X-POS-Token': tok },
    body: JSON.stringify({ po_id: poId, pin: PIN, delivered_date: '2026-08-12', items: [{ plu_id: RIBEYE, qty_received: 99 }] }),
  });
  check('D6-i: over-receive 400', over.status === 400, `status=${over.status} err=${over.body?.error || ''}`);

  // ---- Weighted: fractional receive increments existing row ----
  const inv3 = await admin.from('inventory').select('stock_quantity').eq('product_id', RIBEYE_INV).single();
  const poi = await admin.from('purchase_order_items').select('quantity_received').eq('po_id', poId).eq('plu_id', RIBEYE).single();
  check('W9: POI quantity_received=1.500 stored as 3dp', Number(poi.data.quantity_received) === 1.5, poi.data.quantity_received);
  check('W10: inventory incremented by 1.500 (existing-row path)', Number(inv3.data.stock_quantity) === Number(stockBefore) + 1.5, `after=${inv3.data.stock_quantity} expected=${Number(stockBefore) + 1.5}`);

  // ---- D8 throttle state after test (verify hash-based keys present) ----
  const pub = createClient(URL, SR, { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: 'public' } });
  const att = await pub.from('pos_login_attempts').select('identifier').order('attempted_at', { ascending: false }).limit(8);
  const keys = (att.data || []).map((a) => a.identifier);
  check('D8-e: hash-based identifiers present', keys.some((k) => /^pin:(global|tenant_[a-f0-9]+):[0-9a-f]{24}$/.test(k)), keys.join(', '));
  check('D8-f: no new length-based keys', !keys.some((k) => /:(4|6|8)$/.test(k)), keys.join(', '));

  console.log(`\n=== SUMMARY: ${results.filter((r) => r.ok).length}/${results.length} passed ===`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    failed.forEach((f) => console.log(`  FAILED: ${f.name} ${f.detail}`));
  }
  console.log(`\nEvidence left in tenant: PO ${poId} (partially_received, delivered_date 2026-08-12), tx ${txId} voided. RIBEYE stock now ${inv3.data.stock_quantity}.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('SUITE ERROR', e); process.exit(2); });