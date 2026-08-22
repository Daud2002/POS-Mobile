/**
 * Central React Query key registry.
 *
 * Keeping keys in one place is what makes targeted invalidation possible — the
 * web app has no cache layer at all and simply refetches whole lists after
 * every mutation.
 */
export const queryKeys = {
  products: (storeId: string) => ['products', storeId] as const,
  activeProducts: (storeId: string) => ['products', storeId, 'active'] as const,
  product: (id: string) => ['product', id] as const,

  categories: (storeId: string) => ['categories', storeId] as const,

  orders: () => ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  invoice: (orderId: string) => ['invoice', orderId] as const,

  customers: () => ['customers'] as const,
  customer: (id: string) => ['customer', id] as const,
  customerOrders: (customerId: string) => ['customer', customerId, 'orders'] as const,

  employees: (storeId: string) => ['employees', storeId] as const,

  store: (id: string) => ['store', id] as const,
} as const;
