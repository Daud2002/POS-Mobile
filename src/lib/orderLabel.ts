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
