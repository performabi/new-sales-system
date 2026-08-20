import type { ReceiptLine } from './interfaces';

export const esc = {
  init: () => new Uint8Array([0x1b, 0x40]),
  bold: (on: boolean) => new Uint8Array([0x1b, 0x45, on ? 1 : 0]),
  double: (on: boolean) => new Uint8Array([0x1d, 0x21, on ? 0x11 : 0x00]),
  align: (n: 0 | 1 | 2) => new Uint8Array([0x1b, 0x61, n]),
  feed: (n: number) => new Uint8Array([0x1b, 0x64, n]),
  lineFeed: () => new Uint8Array([0x0a]),
  cut: () => new Uint8Array([0x1d, 0x56, 0x00]),
  kickDrawer: () => new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
  text: (s: string) => {
    const bytes = new TextEncoder().encode(s);
    const out = new Uint8Array(bytes.length + 1);
    out.set(bytes, 0);
    out[bytes.length] = 0x0a;
    return out;
  },
};

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function lineBytes(line: ReceiptLine): Uint8Array {
  const parts: Uint8Array[] = [];
  switch (line.type) {
    case 'header':
      parts.push(esc.align(1), esc.bold(true), esc.double(true), esc.text(line.text), esc.double(false), esc.bold(false));
      break;
    case 'item':
      parts.push(esc.align(0), esc.text(`${line.text}${line.value ? `   ${line.value}` : ''}`));
      break;
    case 'discount':
      parts.push(esc.align(0), esc.text(`${line.text}${line.value ? `   ${line.value}` : ''}`));
      break;
    case 'total':
      parts.push(esc.align(0), esc.bold(true), esc.text(`${line.text}${line.value ? `   ${line.value}` : ''}`), esc.bold(false));
      break;
    case 'payment':
      parts.push(esc.align(1), esc.text(`${line.text}${line.value ? `   ${line.value}` : ''}`));
      break;
    case 'barcode':
      parts.push(esc.align(1), esc.text(line.text));
      break;
    case 'footer':
    default:
      parts.push(esc.align(1), esc.text(line.text));
      break;
  }
  return concat(parts);
}

/** Build a full receipt document (bytes) from a list of receipt lines. */
export function buildReceipt(lines: ReceiptLine[]): Uint8Array {
  const parts: Uint8Array[] = [esc.init(), esc.feed(1)];
  for (const line of lines) parts.push(lineBytes(line));
  parts.push(esc.feed(3), esc.cut());
  return concat(parts);
}

/** ESC/POS bytes for kicking a chained cash drawer. */
export function drawerKickBytes(): Uint8Array {
  return esc.kickDrawer();
}

export interface ReceiptTx {
  transaction_id?: string;
  created_at?: string;
  payment_method?: string;
  payment_note?: string;
  total_amount?: number;
  discount_amount?: number;
  cash_given?: number | null;
  change_due?: number | null;
  sale_items?: Array<{
    plu_name?: string;
    quantity?: number;
    unit_price?: number;
    total_price?: number;
  }>;
}

/** Build ReceiptLine[] from a persisted sales transaction (mirrors ReceiptModal layout). */
export function buildReceiptLines(tx: ReceiptTx, storeName: string, currency: string, formatDate: (d: Date) => string, formatTime: (d: Date) => string): ReceiptLine[] {
  const symbol = currency || '£';
  const created = tx.created_at ? new Date(tx.created_at) : new Date();
  const lines: ReceiptLine[] = [];
  lines.push({ type: 'header', text: storeName });
  lines.push({ type: 'footer', text: `TXN ${String(tx.transaction_id || '').slice(0, 8).toUpperCase()}` });
  lines.push({ type: 'footer', text: `${formatDate(created)} ${formatTime(created)}` });
  lines.push({ type: 'footer', text: '' });
  for (const item of tx.sale_items || []) {
    const amount = (item.total_price ?? (item.unit_price ?? 0) * (item.quantity ?? 0)).toFixed(2);
    lines.push({ type: 'item', text: `${item.plu_name} x${item.quantity}`, value: `${symbol}${amount}` });
  }
  lines.push({ type: 'footer', text: '' });
  if (Number(tx.discount_amount) > 0) {
    lines.push({ type: 'discount', text: 'Discount', value: `-${symbol}${Number(tx.discount_amount).toFixed(2)}` });
  }
  lines.push({ type: 'total', text: 'TOTAL', value: `${symbol}${Number(tx.total_amount ?? 0).toFixed(2)}` });
  lines.push({ type: 'footer', text: '' });
  lines.push({ type: 'payment', text: `PAID BY ${String(tx.payment_method || '').toUpperCase()}` });
  if (tx.payment_note) lines.push({ type: 'payment', text: tx.payment_note });
  if (tx.cash_given != null) {
    lines.push({ type: 'payment', text: `CASH GIVEN ${symbol}${Number(tx.cash_given).toFixed(2)}` });
    lines.push({ type: 'payment', text: `CHANGE ${symbol}${Number(tx.change_due ?? 0).toFixed(2)}` });
  }
  lines.push({ type: 'footer', text: '' });
  lines.push({ type: 'footer', text: 'Thank you for your custom!' });
  return lines;
}