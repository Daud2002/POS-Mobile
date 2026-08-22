import { OrderStatus, PaymentMethod } from '@/api/types';

/**
 * The single source of truth for order-status presentation.
 *
 * The web app has FOUR conflicting maps: OrdersPage uses semantic tokens,
 * StoreAdminDashboard uses raw light-mode-only Tailwind classes,
 * CashierOrdersPage keys off a stale `completed`/`preparing` vocabulary that
 * never matches what the POS writes (so its badges render unstyled), and
 * CustomerOrdersPage inlines yet another ternary.
 */

export type StatusTone = 'success' | 'warning' | 'info' | 'destructive';

const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  paid: 'success',
  completed: 'success',
  unpaid: 'warning',
  pending: 'info',
  cancelled: 'destructive',
  refunded: 'destructive',
};

export function statusTone(status: OrderStatus | string | undefined): StatusTone {
  return STATUS_TONE[status as OrderStatus] ?? 'info';
}

/**
 * Statuses the POS can write. The backend enum also contains `completed`, but
 * the @IsEnum on CreateOrderDto/UpdateOrderDto omits it — it is read-only
 * legacy data that cannot be set through the API.
 */
export const WRITABLE_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'unpaid',
  'cancelled',
  'refunded',
];

/** Filter pills on the Orders screen, matching the web app's set. */
export const ORDER_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'refunded', label: 'Refunded' },
] as const;

export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number]['value'];

/** Payment methods offered at checkout. `check` exists in the enum but has no UI. */
export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
];

export function paymentLabel(method?: PaymentMethod | null): string {
  if (!method) return 'Unpaid';
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}
