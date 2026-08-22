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
