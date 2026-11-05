/**
 * Mirrors POS-Frontend/src/lib/creditSales.ts.
 *
 * Credit sales: an order the customer walked away from owing.
 *
 * On the server such an order is `orderStatus: 'completed'` with
 * `paymentStatus: 'unpaid'` and a `creditedAt`; collecting it later flips it
 * to 'paid' and books the money to whoever collected. These helpers are the
 * client's reading of that, kept pure so they are tested.
 */

import type { CreditCustomerChoice } from '@/api/types';

export type { CreditCustomerChoice };

/**
 * The credit dialog's state as the body the server takes, or null while it
 * cannot be sent: nobody picked yet, or a new customer without a phone (the
 * phone is how the directory finds them again).
 */
export function creditCustomerOf(input: {
  mode: 'find' | 'new';
  picked: { id: string } | null;
  name: string;
  phone: string;
}): CreditCustomerChoice | null {
  if (input.mode === 'find') return input.picked ? { customerId: input.picked.id } : null;
  const phone = input.phone.trim();
  if (!/\d/.test(phone)) return null;
  return { customerName: input.name.trim() || 'Customer', customerPhone: phone };
}

type CreditLike = {
  creditedAt?: string | Date | null;
  paymentStatus?: string | null;
  status?: string | null;
  orderStatus?: string | null;
};

const paymentOf = (o: CreditLike) => o.paymentStatus ?? o.status ?? null;

export function isCreditSale(order: CreditLike | null | undefined): boolean {
  return !!order?.creditedAt;
}

/** On credit and not paid yet. */
export function isCreditOwing(order: CreditLike | null | undefined): boolean {
  return !!order?.creditedAt && paymentOf(order) === 'unpaid';
}

/**
 * Whether an order's total is money taken — the server's revenue rule:
 * completed, except a credit sale nobody has collected yet.
 */
export function countsAsRevenue(order: CreditLike): boolean {
  return order.orderStatus === 'completed' && !isCreditOwing(order);
}

/** Owed first, then paid; each group newest first by when it went on credit. */
export function compareCreditOrders(a: CreditLike, b: CreditLike): number {
  const owingA = isCreditOwing(a);
  const owingB = isCreditOwing(b);
  if (owingA !== owingB) return owingA ? -1 : 1;
  const at = (o: CreditLike) => (o.creditedAt ? new Date(o.creditedAt).getTime() : 0);
  return at(b) - at(a);
}

export function sortCreditOrders<T extends CreditLike>(orders: T[]): T[] {
  return [...orders].sort(compareCreditOrders);
}
