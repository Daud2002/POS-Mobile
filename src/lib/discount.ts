export type DiscountType = 'amount' | 'percent';

export interface ParsedDiscount {
  discountType: DiscountType | null;
  discountValue: number | null;
}

/**
 * Parses what the cashier typed: "250" takes 250 off the order, "25%" takes a
 * quarter off. Mirrors the server parser — the server re-derives and clamps the
 * real figure, so this is only for the live preview and the request body.
 */
export function parseDiscountInput(text: string): ParsedDiscount {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { discountType: null, discountValue: null };

  if (trimmed.endsWith('%')) {
    const value = Number(trimmed.slice(0, -1).trim());
    return { discountType: 'percent', discountValue: Number.isFinite(value) ? value : 0 };
  }

  const value = Number(trimmed);
  return { discountType: 'amount', discountValue: Number.isFinite(value) ? value : 0 };
}

/** Preview only. The server recomputes and clamps before anything is stored. */
export function previewDiscount(text: string, subtotal: number): number {
  const { discountType, discountValue } = parseDiscountInput(text);
  if (!discountType || !discountValue || discountValue <= 0) return 0;

  if (discountType === 'percent') {
    return round2((subtotal * Math.min(discountValue, 100)) / 100);
  }
  return round2(Math.min(discountValue, subtotal));
}

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * What the delivery-charge box starts at on a new delivery. A house figure,
 * not a setting: the cashier overrides it per order when the distance or the
 * rider calls for it.
 */
export const DEFAULT_DELIVERY_CHARGE = 100;

/**
 * Parses the delivery-charge box. Blank means "no charge" rather than "keep
 * the default" — a cashier who clears the box gets a free delivery.
 */
export function parseChargeInput(text: string): number {
  const n = Number((text ?? '').trim());
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

/**
 * The bill, the same way the server computes it: the discount comes off the
 * food, and the delivery charge goes on top of what is left. Only a delivery
 * carries a charge.
 */
export function orderTotal(
  subtotal: number,
  discount: number,
  deliveryCharge: number,
  orderType?: string | null,
): number {
  const charge = orderType === 'delivery' ? Math.max(Number(deliveryCharge) || 0, 0) : 0;
  return round2(Math.max((Number(subtotal) || 0) - (Number(discount) || 0), 0) + charge);
}

/**
 * The discount box, prefilled from what the order already carries — "25%"
 * for a percentage, "250" for a flat amount, blank for none.
 */
export function discountTextOf(order: {
  discountType?: string | null;
  discountValue?: unknown;
}): string {
  if (!order?.discountType) return '';
  const value = Number(order.discountValue) || 0;
  if (value <= 0) return '';
  return order.discountType === 'percent' ? `${value}%` : String(value);
}
