/**
 * Menu ordering. Mirrors POS-Frontend/src/lib/sortOrder.ts.
 *
 * Categories and products each carry a `sortOrder` — a number the owner
 * picks, unique within the store — and every list a cashier or waiter picks
 * from shows them lowest-first by it. The API already returns rows in this
 * order, but every screen filters client-side, so the filtered result is
 * sorted again here: a single category then reads in the same relative order
 * it has under "All", and nothing depends on where the rows came from.
 */

export interface HasSortOrder {
  sortOrder?: number | string | null;
  name?: string | null;
}

/** A row's position; unnumbered (legacy) rows go after every numbered one. */
export function sortOrderOf(item: HasSortOrder): number {
  const raw = item.sortOrder;
  if (raw === null || raw === undefined || raw === '') return Number.POSITIVE_INFINITY;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

/** Lowest number first; ties (only possible among unnumbered rows) by name. */
export function compareBySortOrder(a: HasSortOrder, b: HasSortOrder): number {
  const left = sortOrderOf(a);
  const right = sortOrderOf(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return (a.name ?? '').localeCompare(b.name ?? '');
}

/** A sorted copy; the input is left alone. */
export function sortBySortOrder<T extends HasSortOrder>(items: readonly T[]): T[] {
  return [...items].sort(compareBySortOrder);
}

/**
 * A form field's text, as the value to send.
 *
 * Blank means "no preference" and comes back `undefined`, which leaves the
 * server to put a new row at the end. Anything that is not a whole,
 * non-negative number comes back `null` so the form can refuse it.
 */
export function parseSortOrderInput(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}
