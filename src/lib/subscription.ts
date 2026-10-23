/**
 * Subscription expiry, in calendar days.
 *
 * The server stores the day a store is paid through as 'YYYY-MM-DD' with no
 * time and no zone; "days left" is counted on the device's own calendar.
 * Mirrors POS-Backend/src/common/subscription.ts and the web copy — the
 * three must agree on when the banner turns yellow and red.
 */

export type SubscriptionAlertLevel = 'none' | 'warning' | 'critical';

/** Yellow from this many days before expiry (inclusive) … */
export const SUBSCRIPTION_WARNING_DAYS = 3;
/** … and red from this many days before, through expiry and beyond. */
export const SUBSCRIPTION_CRITICAL_DAYS = 1;

export interface SubscriptionAlert {
  level: SubscriptionAlertLevel;
  /** Whole days until expiry; negative once past; null when no date is set. */
  daysLeft: number | null;
  expiresAt: string | null;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * 'YYYY-MM-DD' → local midnight. Never `new Date('YYYY-MM-DD')`, which is UTC
 * midnight and reads as the previous evening anywhere east of Greenwich.
 */
export function parseIsoDay(day: string | null | undefined): Date | null {
  if (!day) return null;
  const match = ISO_DAY.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  const parsed = new Date(year, month - 1, date);
  return parsed.getMonth() === month - 1 ? parsed : null;
}

/** Whole calendar days from `today` until `expiresAt`; null if unparseable. */
export function daysUntil(expiresAt: string | null | undefined, today: Date = new Date()): number | null {
  const target = parseIsoDay(expiresAt);
  if (!target) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function subscriptionAlertLevel(daysLeft: number | null | undefined): SubscriptionAlertLevel {
  if (daysLeft === null || daysLeft === undefined || !Number.isFinite(daysLeft)) return 'none';
  if (daysLeft <= SUBSCRIPTION_CRITICAL_DAYS) return 'critical';
  if (daysLeft <= SUBSCRIPTION_WARNING_DAYS) return 'warning';
  return 'none';
}

/**
 * What the dashboard should show. A store with no date recorded is silent:
 * every store started out that way, and the release must not paint every
 * dashboard red before the admin has entered anything.
 */
export function subscriptionAlert(expiresAt: string | null | undefined, today: Date = new Date()): SubscriptionAlert {
  const daysLeft = daysUntil(expiresAt, today);
  return { level: subscriptionAlertLevel(daysLeft), daysLeft, expiresAt: expiresAt ?? null };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-21' → '21 Oct 2026'. */
export function formatExpiry(day: string | null | undefined): string {
  const date = parseIsoDay(day);
  if (!date) return '—';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** The sentence in the banner, or null when there is nothing to say. */
export function subscriptionMessage(alert: SubscriptionAlert): string | null {
  if (alert.level === 'none' || alert.daysLeft === null) return null;
  const when = formatExpiry(alert.expiresAt);
  const renew = 'Please contact TapNtrade to renew.';
  if (alert.daysLeft < 0) return `Your subscription expired on ${when}. ${renew}`;
  if (alert.daysLeft === 0) return `Your subscription expires today (${when}). ${renew}`;
  if (alert.daysLeft === 1) return `Your subscription expires tomorrow (${when}). ${renew}`;
  return `Your subscription expires in ${alert.daysLeft} days (${when}). ${renew}`;
}
