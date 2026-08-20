// P3 peripheral regression smoke — pure logic (DOM-free) coverage.
// Browser-only drivers (serial/usb) are covered by manual hardware checklists.
import { buildReceipt, buildReceiptLines, drawerKickBytes } from './src/devices/escpos.ts';
import { normalizeDeviceConfig, DEFAULT_DEVICE_CONFIG } from './src/devices/interfaces.ts';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, detail); }
}

// ---- escpos ----
const kick = drawerKickBytes();
check('drawer kick bytes 1b 70 00 19 fa', kick.length === 5 && kick[0] === 0x1b && kick[1] === 0x70 && kick[4] === 0xfa);
const rec = buildReceipt([{ type: 'header', text: 'S' }, { type: 'total', text: 'TOTAL', value: '£10.50' }]);
check('receipt init ESC@', rec[0] === 0x1b && rec[1] === 0x40);
check('receipt cut tail', rec[rec.length - 3] === 0x1d && rec[rec.length - 2] === 0x56);

// ---- receipt lines from a persisted tx ----
const tx = {
  transaction_id: 'tx-abc-1234',
  created_at: '2026-08-21T10:30:00Z',
  payment_method: 'cash',
  total_amount: 10.5,
  cash_given: 11,
  change_due: 0.5,
  sale_items: [{ plu_name: 'RIBEYE', quantity: 0.5, unit_price: 20.99, total_price: 10.5 }],
};
const lines = buildReceiptLines(tx, 'Test Store', '£',
  (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
const text = lines.map((l) => `${l.type}:${l.text}:${l.value || ''}`).join('\n');
check('receipt lines include store header', text.includes('header:Test Store'));
check('receipt lines include item RIBEYE x0.5 £10.50', text.includes('item:RIBEYE x0.5:£10.50'));
check('receipt lines include TOTAL £10.50', text.includes('total:TOTAL:£10.50'));
check('receipt lines include CASH GIVEN £11.00', text.includes('payment:CASH GIVEN £11.00'));
check('receipt lines include CHANGE £0.50', text.includes('payment:CHANGE £0.50'));
check('receipt lines include PAID BY CASH', text.includes('PAID BY CASH'));

// ---- config normalization ----
const d = normalizeDeviceConfig(null);
check('defaults scale protocol ascii', d.scale.protocol === 'ascii' && d.scale.baud === 9600 && d.scale.enabled === false);
check('defaults printer transport usb', d.printer.transport === 'usb' && d.printer.enabled === false);
check('defaults drawer chained', d.drawer.mode === 'chained' && d.drawer.enabled === false);
check('defaults deep-equal DEFAULT_DEVICE_CONFIG', JSON.stringify(d) === JSON.stringify(DEFAULT_DEVICE_CONFIG));
const partial = normalizeDeviceConfig({ scale: { enabled: true, protocol: 'bare', baud: 19200 } });
check('partial merge keeps printer defaults', partial.printer.transport === 'usb' && partial.printer.model === '');
check('partial merge applies scale overrides', partial.scale.enabled === true && partial.scale.protocol === 'bare' && partial.scale.baud === 19200);

console.log(`\nperipherals-smoke: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
