import { round2 } from './format';

/**
 * Cart totals.
 *
 * `POST /orders` recomputes `subtotal` server-side but takes `total` VERBATIM
 * from the client. This must therefore reproduce the web POS's arithmetic
 * exactly (Frontend/src/pages/cashier/POSScreen.tsx:272-279) or the two clients
 * will write different totals for identical carts.
 *
 *   rawSubtotal           = Σ price × qty
 *   itemDiscounts         = Σ itemDiscountPerUnit × qty
 *   subtotal              = rawSubtotal − itemDiscounts
 *   tax                   = 0                       (hardcoded on web)
 *   percentageDiscountAmt = subtotal × (discount / 100)
 *   total                 = subtotal + tax − percentageDiscountAmt
 *
 * Note the asymmetry: the `discount` sent to the API is
 * `itemDiscounts + percentageDiscountAmt`, but `total` subtracts only
 * `percentageDiscountAmt` — item discounts are already inside `subtotal`.
 */

export interface CartLineTotals {
  price: number;
  quantity: number;
  itemDiscountPerUnit: number;
}

export interface OrderTotals {
  /** Σ price × qty, before any discount. This is what the receipt prints. */
  rawSubtotal: number;
  /** Σ perUnitDiscount × qty. */
  itemDiscounts: number;
  /** rawSubtotal − itemDiscounts. */
  subtotal: number;
  tax: number;
  /** subtotal × percentage. */
  percentageDiscountAmt: number;
  /** itemDiscounts + percentageDiscountAmt — the value sent as `discount`. */
  totalDiscount: number;
  total: number;
}

/**
 * @param lines            cart lines
 * @param discountPercent  order-level percentage discount (the web app's
 *                         picker is commented out, so this is always 0 there)
 */
export function calculateOrderTotals(
  lines: CartLineTotals[],
  discountPercent = 0,
): OrderTotals {
  const rawSubtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const itemDiscounts = lines.reduce(
    (sum, line) => sum + (line.itemDiscountPerUnit || 0) * line.quantity,
    0,
  );
  const subtotal = rawSubtotal - itemDiscounts;

  // Tax is hardcoded to 0 on web; the 8% line is commented out. Kept as a named
  // value so adding real tax later is a single change here.
  const tax = 0;

  const percentageDiscountAmt = subtotal * (discountPercent / 100);
  const total = subtotal + tax - percentageDiscountAmt;

  return {
    rawSubtotal: round2(rawSubtotal),
    itemDiscounts: round2(itemDiscounts),
    subtotal: round2(subtotal),
    tax: round2(tax),
    percentageDiscountAmt: round2(percentageDiscountAmt),
    totalDiscount: round2(itemDiscounts + percentageDiscountAmt),
    total: round2(total),
  };
}

/** The per-line `discount` the API expects: a LINE total, not a per-unit value. */
export function lineDiscountTotal(line: CartLineTotals): number {
  return round2((line.itemDiscountPerUnit || 0) * line.quantity);
}
