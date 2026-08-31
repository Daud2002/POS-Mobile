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
  dine_out: 'Dine-out',
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

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  requested: 'Requested',
  preparing: 'Preparing',
  handed_over: 'Ready to bill',
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
