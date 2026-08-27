import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/api/queryKeys';
import { expensesApi, ordersApi, productsApi } from '@/api/services';
import { Order, Product } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { can } from '@/lib/access';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/constants/config';
import { useStoreId } from '@/hooks/useStoreId';
import { lastNDays, localDateKey, weekdayLabel } from '@/lib/date';
import { toNumber } from '@/lib/format';

/** Statuses that count as money taken. */
function isRevenueOrder(order: Order): boolean {
  return order.status === 'paid' || order.status === 'completed';
}

function isLowStock(product: Product): boolean {
  const threshold = product.lowStockAlertQuantity ?? DEFAULT_LOW_STOCK_THRESHOLD;
  return product.stock < threshold && product.isActive;
}

/**
 * Store dashboard metrics, computed client-side.
 *
 * There is no analytics endpoint — the web app's `getAnalytics` method points
 * at a `/analytics` route that does not exist and is never called — so every
 * figure here is derived from the orders and products lists.
 *
 * Date bucketing uses LOCAL date keys. The web Reports page uses
 * `toISOString()` for this, which shifts to UTC and mis-buckets evening orders.
 */
export function useDashboardData() {
  const storeId = useStoreId();
  const { user } = useAuth();

  const ordersQuery = useQuery({
    queryKey: queryKeys.orders(),
    queryFn: () => ordersApi.list(0, 1000),
  });

  const productsQuery = useQuery({
    queryKey: queryKeys.products(storeId ?? ''),
    queryFn: () => productsApi.list(storeId!, 0, 1000),
    enabled: !!storeId,
  });

  /**
   * Today's spend, which unlike everything else here IS a server-computed
   * figure — expenses are filed against a calendar day, so the API can total
   * them directly rather than the app pulling the whole ledger down.
   *
   * Behind the expenses module: an employee given the dashboard but not
   * expenses must not see the store's outgoings.
   */
  const canSeeExpenses = can(user, 'expenses');
  const todayKeyForExpenses = localDateKey(new Date());
  const expensesQuery = useQuery({
    queryKey: queryKeys.expenseSummary(todayKeyForExpenses),
    queryFn: () => expensesApi.summary(todayKeyForExpenses),
    enabled: canSeeExpenses,
  });

  const metrics = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const products = productsQuery.data ?? [];

    const todayKey = localDateKey(new Date());

    const ordersToday = orders.filter(
      (order) => localDateKey(order.createdAt) === todayKey,
    );

    const todayRevenue = ordersToday
      .filter(isRevenueOrder)
      .reduce((sum, order) => sum + toNumber(order.total), 0);

    const lowStock = products.filter(isLowStock);

    // Revenue per local day for the last week.
    const revenueByDay = new Map<string, number>();
    for (const order of orders) {
      if (!isRevenueOrder(order)) continue;
      const key = localDateKey(order.createdAt);
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + toNumber(order.total));
    }

    const weeklySales = lastNDays(7).map((day) => ({
      label: weekdayLabel(day),
      value: revenueByDay.get(localDateKey(day)) ?? 0,
    }));

    // Actual best sellers by quantity sold — the web "Top Products" panel just
    // sorts by price descending, which is not a bestseller list at all.
    const soldByProduct = new Map<string, { name: string; quantity: number }>();
    for (const order of orders) {
      for (const item of order.items ?? []) {
        const existing = soldByProduct.get(item.productId);
        soldByProduct.set(item.productId, {
          name: item.productName ?? existing?.name ?? 'Item',
          quantity: (existing?.quantity ?? 0) + item.quantity,
        });
      }
    }

    const topProducts = [...soldByProduct.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const recentOrders = [...orders]
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);

    return {
      todayRevenue,
      todayOrderCount: ordersToday.length,
      totalOrders: orders.length,
      productCount: products.length,
      lowStockCount: lowStock.length,
      weeklySales,
      topProducts,
      recentOrders,
    };
  }, [ordersQuery.data, productsQuery.data]);

  return {
    ...metrics,
    canSeeExpenses,
    todayExpenses: expensesQuery.data?.today ?? 0,
    monthExpenses: expensesQuery.data?.month ?? 0,
    loading: ordersQuery.isLoading || productsQuery.isLoading,
    refetching: ordersQuery.isRefetching || productsQuery.isRefetching,
    refetch: () => {
      void ordersQuery.refetch();
      void productsQuery.refetch();
      void expensesQuery.refetch();
    },
  };
}
