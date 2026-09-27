/**
 * How a restaurant order is shown to people: "#7", counting from 1 per store.
 *
 * `orderNumber` remains an internal, globally-unique `ORD-<ts>-<rand>` because
 * its column is uniquely indexed across every tenant — two restaurants both
 * having an order 1 is expected and would collide there.
 */
export function orderLabel(order: {
  orderSequence?: number | null;
  orderNumber?: string;
}): string {
  if (order?.orderSequence) return `#${order.orderSequence}`;
  // Restaurant rows created before per-store numbering, and general orders,
  // fall back to the timestamp segment of the internal number.
  return order?.orderNumber
    ? `#${order.orderNumber.split('-')[1] ?? order.orderNumber}`
    : '#—';
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Dine-in',
  // Stored as dine_out; to people it is simply an order with parcels in it.
  dine_out: 'Parcel',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

/**
 * How an order type is written for people.
 *
 * Centralised because the codebase previously spread
 * `orderType === 'delivery' ? 'Delivery' : 'Takeaway'` across many call sites —
 * a ternary that silently mislabels every type that is not delivery, and would
 * have printed "Takeaway" on a dine-out bill.
 */
export function orderTypeLabel(orderType?: string | null): string {
  if (!orderType || orderType === 'none') return '—';
  return ORDER_TYPE_LABELS[orderType] ?? orderType.replace(/_/g, ' ');
}

/**
 * What the paper says the order is: DINE-IN, PARCEL, or DINE-IN + PARCEL.
 *
 * A waiter never picks a type; they mark lines as parcel and everything else
 * is eaten in. So for a table order the label is read off the lines rather
 * than the stored type, which cannot tell "some parcel" from "all parcel".
 * Takeaway and delivery have no table and keep their own name.
 */
export function serviceLabel(
  orderType?: string | null,
  items: Array<{ isParcel?: boolean | null }> = [],
): string {
  if (!orderTypeNeedsTable(orderType)) {
    return orderType && orderType !== 'none' ? orderTypeLabel(orderType).toUpperCase() : '';
  }
  const parcels = items.filter((item) => !!item.isParcel).length;
  if (parcels === 0) return 'DINE-IN';
  return parcels === items.length ? 'PARCEL' : 'DINE-IN + PARCEL';
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  requested: 'Requested',
  preparing: 'Preparing',
  handed_over: 'Ready to bill',
  bill_printed: 'Bill printed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Restaurant lifecycle status, in words.
 *
 * `handed_over` reads as "Ready to bill" because the screens showing it are
 * the cashier's and the owner's: what matters to them is that the food is out
 * and the money is owed.
 */
export function orderStatusLabel(status?: string | null): string {
  if (!status || status === 'none') return '—';
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

/**
 * The status an order is SHOWN with.
 *
 * "Bill printed" is not a member of the kitchen lifecycle on the server — a
 * takeaway is billed while the kitchen is still cooking it — but to the person
 * at the till it is the state that matters: the paper is out, the money is
 * owed, and the order is theirs. So a live order whose bill has been printed
 * displays as `bill_printed`, whatever the kitchen is doing.
 */
export function orderDisplayStatus(order: {
  orderStatus?: string | null;
  billPrinted?: boolean | null;
  billPrintedAt?: string | null;
}): string {
  const status = order?.orderStatus ?? '';
  const printed = !!(order?.billPrinted || order?.billPrintedAt);
  const live = status === 'requested' || status === 'preparing' || status === 'handed_over';
  return printed && live ? 'bill_printed' : status;
}

/** Order types that occupy a table. Mirrors needsTable() on the server. */
export function orderTypeNeedsTable(orderType?: string | null): boolean {
  return orderType === 'dine_in' || orderType === 'dine_out';
}

/**
 * Where an order is served: its table if it has one, otherwise its type.
 * Replaces the `tableName ?? (delivery ? 'Delivery' : 'Takeaway')` ternaries.
 */
export function orderDestination(order: {
  tableName?: string | null;
  orderType?: string | null;
}): string {
  if (order?.tableName) return order.tableName;
  return orderTypeLabel(order?.orderType);
}
