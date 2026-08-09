import { useAppStore } from '../store/appStore';

export function getCurrencySymbol(): string {
  return useAppStore.getState().currencyConfig?.symbol || '£';
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (Number.isNaN(n)) return `${getCurrencySymbol()}0.00`;
  return `${getCurrencySymbol()}${n.toFixed(2)}`;
}
