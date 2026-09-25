import type { InventoryItem, InventoryMovementType, InventoryUnit } from '@/api/types';

/**
 * Pure helpers for restaurant ingredient stock. Kept free of React so the
 * rules the screen shows (what counts as low, how bottles read as sets) are
 * unit-tested rather than eyeballed.
 */

export const INVENTORY_UNITS: ReadonlyArray<{ value: InventoryUnit; label: string }> = [
  { value: 'ml', label: 'Millilitres (ml)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'bottle', label: 'Bottles' },
];

export const DEFAULT_PACK_SIZE = 6;

/** Up to three decimals — the server's scale — with trailing zeros dropped. */
export function formatAmount(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  // Normalise -0 so a zeroed count never prints as "-0".
  return String(rounded === 0 ? 0 : rounded);
}

/** Short suffix for an input or a count: "ml", "g", "bottles". */
export function unitSuffix(unit: InventoryUnit, amount?: number): string {
  if (unit === 'bottle') return amount === 1 ? 'bottle' : 'bottles';
  return unit;
}

/** "250 ml", "1 bottle", "-3 g". */
export function formatQuantity(value: number, unit: InventoryUnit): string {
  return `${formatAmount(value)} ${unitSuffix(unit, value)}`;
}

/**
 * Bottles re-read as sets, e.g. 27 bottles in sets of 6 → "4 sets + 3".
 * Null when it adds nothing: not a bottle item, fewer than one set, a
 * negative count, or a fractional one.
 */
export function formatSets(quantity: number, packSize: number): string | null {
  if (packSize <= 1 || quantity < packSize || !Number.isInteger(quantity)) return null;
  const sets = Math.floor(quantity / packSize);
  const loose = quantity - sets * packSize;
  const setLabel = `${sets} set${sets === 1 ? '' : 's'}`;
  return loose > 0 ? `${setLabel} + ${loose}` : setLabel;
}

/** Below zero means sales ran ahead of the count — always worth flagging. */
export function isLowStock(item: Pick<InventoryItem, 'quantity' | 'lowStockThreshold'>): boolean {
  if (item.quantity < 0) return true;
  return item.lowStockThreshold !== null && item.quantity <= item.lowStockThreshold;
}

/** What a stock-in will add, in the item unit — mirrors the server's sum. */
export function stockInTotal(
  item: Pick<InventoryItem, 'unit' | 'packSize'>,
  amount: number,
  inPacks: boolean,
): number {
  return item.unit === 'bottle' && inPacks ? amount * item.packSize : amount;
}

export const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  stock_in: 'Stock in',
  sale: 'Sale',
  adjustment: 'Adjustment',
};

/** Parses a decimal text field; null for blank or anything not a finite number. */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
