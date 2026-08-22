import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { ordersApi } from '@/api/services';
import { PaymentMethod } from '@/api/types';
import { useToast } from '@/components/ui/Toast';
import { OrderStatusFilter } from '@/constants/statuses';

/** Order list with client-side status filtering, plus the Mark Paid mutation. */
export function useOrders() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [filter, setFilter] = useState<OrderStatusFilter>('all');

  const query = useQuery({
    queryKey: queryKeys.orders(),
    // The backend derives the store from the JWT, so no storeId is needed.
    queryFn: () => ordersApi.list(0, 1000),
  });

  const orders = useMemo(() => {
    const all = query.data ?? [];
    return filter === 'all' ? all : all.filter((order) => order.status === filter);
  }, [query.data, filter]);

  const markPaid = useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method?: PaymentMethod }) =>
      ordersApi.markAsPaid(orderId, method),
    onSuccess: () => {
      toast.success('Order marked as paid');
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not mark the order as paid.',
      );
    },
  });

  return {
    orders,
    filter,
    setFilter,
    loading: query.isLoading,
    refetching: query.isRefetching,
    refetch: query.refetch,
    error: query.error,
    markPaid: markPaid.mutateAsync,
    markingPaid: markPaid.isPending,
  };
}
