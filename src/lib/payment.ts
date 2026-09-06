import type { PaymentSplit } from '@/api/types';

import { round2, toNumber } from './format';

/**
 * Split payments — a customer paying part by card and the rest in cash.
 *
 * The cashier types an amount per method; the server refuses anything that
 * does not add up to the bill, so the helpers here exist to show the cashier
 * where they stand BEFORE they press the button. Mirrors the server's
 * resolvePayment() in Backend/src/modules/restaurant/order-rules.ts and the
 * web app's lib/payment.ts.
 */
export type SplitMethod = 'cash' | 'card' | 'online';

export const SPLIT_METHODS: SplitMethod[] = ['cash', 'card', 'online'];

/** What is in the three input boxes. */
export type SplitText = Record<SplitMethod, string>;

export const EMPTY_SPLIT_TEXT: SplitText = { cash: '', card: '', online: '' };

/** Blank and unparseable boxes count as zero. */
export function parseSplit(text: SplitText): PaymentSplit {
  const amount = (value: string) => {
    const n = Number((value ?? '').trim());
    return Number.isFinite(n) && n > 0 ? round2(n) : 0;
  };
  return { cash: amount(text.cash), card: amount(text.card), online: amount(text.online) };
}

export function splitSum(split: PaymentSplit): number {
  return round2(split.cash + split.card + split.online);
}

/** Positive: still to allocate. Negative: over. */
export function splitRemaining(total: number, split: PaymentSplit): number {
  return round2(round2(total) - splitSum(split));
}

export function isSplitBalanced(total: number, split: PaymentSplit): boolean {
  return Math.abs(splitRemaining(total, split)) < 0.01;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  online: 'Online',
  check: 'Cheque',
  partial: 'Split',
};

export function paymentMethodLabel(method?: string | null): string {
  if (!method) return '';
  return METHOD_LABELS[method] ?? method;
}

/** The non-zero parts of a split payment, each with its label. */
export function paymentParts(order: {
  paymentMethod?: string | null;
  paymentSplit?: Partial<PaymentSplit> | null;
  paidCash?: unknown;
  paidCard?: unknown;
  paidOnline?: unknown;
}): Array<{ method: SplitMethod; label: string; amount: number }> {
  if (order?.paymentMethod !== 'partial') return [];
  const split: PaymentSplit = {
    cash: toNumber(order.paymentSplit?.cash ?? (order.paidCash as never)),
    card: toNumber(order.paymentSplit?.card ?? (order.paidCard as never)),
    online: toNumber(order.paymentSplit?.online ?? (order.paidOnline as never)),
  };
  return SPLIT_METHODS.filter((m) => split[m] > 0).map((m) => ({
    method: m,
    label: paymentMethodLabel(m),
    amount: split[m],
  }));
}

/**
 * How an order was paid, for a list row: "Cash", or for a split payment each
 * part with its amount — "Cash Rs1,000 · Card Rs650". Null when unpaid.
 */
export function paymentSummary(
  order: Parameters<typeof paymentParts>[0],
  money: (amount: number) => string,
): string | null {
  if (!order?.paymentMethod) return null;
  if (order.paymentMethod !== 'partial') return paymentMethodLabel(order.paymentMethod);
  const parts = paymentParts(order).map((p) => `${p.label} ${money(p.amount)}`);
  return parts.length ? parts.join(' · ') : 'Split';
}
