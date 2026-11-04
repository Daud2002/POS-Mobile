import type { ProfitPeriodKey } from '@/api/types';

/** The windows a dashboard reports on, in the order the picker shows them. */
export const PROFIT_PERIODS: { key: ProfitPeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'last3Months', label: 'Past 3 months' },
  { key: 'last6Months', label: 'Past 6 months' },
  { key: 'thisYear', label: 'This year' },
  { key: 'allTime', label: 'All time' },
];

/**
 * The same day-of-month `n` calendar months earlier, clamped to the shorter
 * month (31 May − 3 months → 29 Feb in a leap year, 28 otherwise).
 *
 * "Past 3 months" to an owner means from the same date last quarter until
 * now, not a rolling 90 days — the same rule the server applies.
 */
function monthsBack(now: Date, n: number): Date {
  const first = new Date(now.getFullYear(), now.getMonth() - n, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(now.getDate(), lastDay));
}

/**
 * When a window opens, as an ISO instant for a report's `from` — or
 * undefined for "all time", meaning no lower bound.
 *
 * Mirrors the server's `periodStarts` (POS-Backend/src/common/periods.ts),
 * computed here in the device's own zone: local midnight on the window's
 * first day. GET /reports/profit derives the same windows server-side from
 * the zone the device sends, so the sales report and the profit report on
 * one dashboard always cover the same orders.
 */
export function periodStart(key: ProfitPeriodKey, now = new Date()): string | undefined {
  const year = now.getFullYear();
  const month = now.getMonth();
  const starts: Record<ProfitPeriodKey, Date | null> = {
    today: new Date(year, month, now.getDate()),
    thisMonth: new Date(year, month, 1),
    last3Months: monthsBack(now, 3),
    last6Months: monthsBack(now, 6),
    thisYear: new Date(year, 0, 1),
    allTime: null,
  };
  return starts[key]?.toISOString();
}

export type SalesRangeKey = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth';

/** The item sales list's windows, in the order the pills show them. */
export const SALES_RANGES: { value: SalesRangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
];

/**
 * `[from, to)` for a sales window, as ISO instants at the device's local
 * midnights — the same convention as periodStart(). `to` is exclusive, so
 * "today" is midnight to the next midnight. Weeks start on Monday.
 */
export function salesRangeBounds(key: SalesRangeKey, now = new Date()): { from: string; to: string } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const sinceMonday = (now.getDay() + 6) % 7;
  const bounds: Record<SalesRangeKey, [Date, Date]> = {
    today: [new Date(year, month, day), new Date(year, month, day + 1)],
    yesterday: [new Date(year, month, day - 1), new Date(year, month, day)],
    thisWeek: [new Date(year, month, day - sinceMonday), new Date(year, month, day + 1)],
    thisMonth: [new Date(year, month, 1), new Date(year, month, day + 1)],
    lastMonth: [new Date(year, month - 1, 1), new Date(year, month, 1)],
  };
  const [from, to] = bounds[key];
  return { from: from.toISOString(), to: to.toISOString() };
}
