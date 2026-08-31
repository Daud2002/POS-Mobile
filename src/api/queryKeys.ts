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
  employeePermissions: (id: string) => ['employee', id, 'permissions'] as const,

  // Expenses. Store-scoped like everything else, but the filter is part of the
  // key so switching range does not serve the previous range's rows.
  expenses: (filter?: string) => ['expenses', filter ?? 'all'] as const,
  expenseCategories: () => ['expenses', 'categories'] as const,
  expenseSummary: (day: string) => ['expenses', 'summary', day] as const,

  store: (id: string) => ['store', id] as const,

  // Restaurant. Socket events invalidate these rather than refetching blindly.
  restaurantTables: () => ['restaurant', 'tables'] as const,
  restaurantOrders: (filter?: string) => ['restaurant', 'orders', filter ?? 'all'] as const,
  restaurantOrder: (id: string) => ['restaurant', 'order', id] as const,
  restaurantReport: (range: string) => ['restaurant', 'report', range] as const,

  /**
   * Cashier shifts. Deliberately under the 'restaurant' prefix so the existing
   * `invalidateQueries({ queryKey: ['restaurant'] })` after settling an order
   * refreshes the till header too.
   */
  currentShift: () => ['restaurant', 'shift', 'current'] as const,
  myShifts: () => ['restaurant', 'shifts', 'mine'] as const,
  shifts: (filter?: string) => ['restaurant', 'shifts', filter ?? 'all'] as const,
  shift: (id: string) => ['restaurant', 'shift', id] as const,
  cashierDashboard: (range: string) => ['restaurant', 'shift', 'dashboard', range] as const,
  cashierSummary: (range: string) => ['restaurant', 'shifts', 'summary', range] as const,
} as const;
