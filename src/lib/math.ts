export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Precise decimal arithmetic using integer math to avoid floating-point errors.
 * All operations are performed in integer cents/mills then converted back.
 */
export function moneyMath(op: 'add' | 'sub' | 'mul', a: number, b: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const aInt = Math.round(a * factor);
  const bInt = Math.round(b * factor);
  let result: number;
  if (op === 'add') result = aInt + bInt;
  else if (op === 'sub') result = aInt - bInt;
  else result = Math.round((aInt * bInt) / factor);
  return result / factor;
}

/**
 * Precise sum of multiple numbers using integer math.
 */
export function moneySum(values: number[], decimals = 2): number {
  const factor = 10 ** decimals;
  const sumInt = values.reduce((sum, v) => sum + Math.round(v * factor), 0);
  return sumInt / factor;
}

/**
 * Multiply quantity (can be 3dp for weight) by unit price (2dp) and round to 2dp.
 */
export function qtyPriceTotal(qty: number, unitPrice: number): number {
  return round2(qty * unitPrice);
}