import { Decimal } from '@/api/types';

/**
 * Coerces an API money value to a number.
 *
 * TypeORM returns Postgres `decimal` columns as strings on /orders, so
 * `order.total` may be `"1234.00"`. Every arithmetic or comparison on a money
 * field must go through this.
 */
export function toNumber(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Rounds to 2dp without floating-point drift (0.1 + 0.2 style errors). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Truncates with an ellipsis, for names in tight list rows. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** First letter, for avatar circles. Matches the web app's initial avatars. */
export function initial(name?: string | null): string {
  return name?.trim()?.charAt(0)?.toUpperCase() ?? '?';
}

/**
 * The display order number.
 *
 * `orderNumber` is `ORD-${Date.now()}`, and every screen shows only the numeric
 * half. Falls back to the whole string if the format ever changes.
 */
export function orderNumberLabel(orderNumber?: string | null): string {
  if (!orderNumber) return '—';
  const [, suffix] = orderNumber.split('-');
  return suffix ?? orderNumber;
}
