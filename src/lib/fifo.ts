import { round2 } from './math';

export interface FifoLayer {
  qty: number;
  cost: number;
  date: string;
}

export interface FifoResult {
  cogs: number;
  remaining: FifoLayer[];
}

/**
 * Consume sales quantity from FIFO layers (oldest first).
 * Returns total COGS for this sale qty and updated remaining layers.
 */
export function fifoCogs(layers: FifoLayer[], salesQty: number): FifoResult {
  let remainingQty = salesQty;
  let cogs = 0;
  const remaining: FifoLayer[] = layers.map((l) => ({ ...l }));
  for (const layer of remaining) {
    if (remainingQty <= 0) break;
    if (layer.qty <= 0) continue;
    const consume = Math.min(layer.qty, remainingQty);
    cogs += consume * layer.cost;
    layer.qty -= consume;
    remainingQty -= consume;
  }
  // remove empty layers
  const filtered = remaining.filter((l) => l.qty > 1e-9);
  return { cogs: round2(cogs), remaining: filtered };
}

export function buildLayers(
  poItems: Array<{ plu_id: string; quantity_received: number; cost_price_at_order: number; delivered_date?: string | null; received_at?: string | null }>,
): Map<string, FifoLayer[]> {
  const map = new Map<string, FifoLayer[]>();
  for (const item of poItems) {
    if (!item.plu_id || (Number(item.quantity_received) || 0) <= 0) continue;
    const date = item.delivered_date || item.received_at || new Date().toISOString();
    const layer: FifoLayer = { qty: Number(item.quantity_received), cost: Number(item.cost_price_at_order) || 0, date };
    const arr = map.get(item.plu_id) || [];
    arr.push(layer);
    map.set(item.plu_id, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
  return map;
}
