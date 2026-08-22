import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { customersApi, ordersApi } from '@/api/services';
import { Order, PaymentMethod } from '@/api/types';
import { RootStackScreenProps } from '@/app/navigation/types';
import { KeyValueRow } from '@/components/data/KeyValueRow';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { OrderCard } from '@/features/orders/components/OrderCard';
import { PaymentMethodSheet } from '@/features/orders/components/PaymentMethodSheet';
import { useReprint } from '@/features/orders/hooks/useReprint';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { displayDate } from '@/lib/date';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/** A customer's purchase history, with Mark Paid for outstanding credit sales. */
export function CustomerOrdersScreen({ route }: RootStackScreenProps<'CustomerOrders'>) {
  const { customerId } = route.params;
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { format } = useStoreCurrency();
  const { reprint, reprintingId } = useReprint();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);

  const query = useQuery({
    queryKey: queryKeys.customerOrders(customerId),
    queryFn: () => customersApi.getWithOrders(customerId),
  });

  const markPaid = useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method: PaymentMethod }) =>
      ordersApi.markAsPaid(orderId, method),
    onSuccess: () => {
      toast.success('Order marked as paid');
      queryClient.invalidateQueries({ queryKey: queryKeys.customerOrders(customerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
      setPayingOrder(null);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'Could not mark the order as paid.',
      ),
  });

  const customer = query.data?.customer;
  const orders = query.data?.orders ?? [];
  const totalSpent = orders.reduce((sum, order) => sum + toNumber(order.total), 0);

  if (query.isLoading) {
    return (
      <Screen>
        <SkeletonList count={5} lines={2} />
      </Screen>
    );
  }

  return (
    <Screen scrollable onRefresh={query.refetch} refreshing={query.isRefetching}>
      <Card padding="xl">
        <Text variant="h2">{customer?.name ?? 'Customer'}</Text>
        {customer?.phone ? (
          <Text variant="caption" color="mutedForeground">
            {[customer.phone, customer.city].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        <Divider spacing="lg" />

        <KeyValueRow label="Total Orders" value={String(orders.length)} />
        <KeyValueRow label="Total Spent" value={format(totalSpent)} emphasis />
        {customer?.createdAt ? (
          <KeyValueRow label="Member Since" value={displayDate(customer.createdAt)} />
        ) : null}
      </Card>

      {orders.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          description="Orders placed for this customer will appear here."
          icon={<ShoppingBag size={28} color={theme.colors.mutedForeground} />}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="overline" color="mutedForeground">
            Purchases
          </Text>

          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() =>
                setExpandedId((current) => (current === order.id ? null : order.id))
              }
              onReprint={reprint}
              reprinting={reprintingId === order.id}
              onMarkPaid={setPayingOrder}
              markingPaid={markPaid.isPending && payingOrder?.id === order.id}
            />
          ))}
        </View>
      )}

      <PaymentMethodSheet
        open={!!payingOrder}
        onClose={() => setPayingOrder(null)}
        onConfirm={(method) =>
          payingOrder && markPaid.mutate({ orderId: payingOrder.id, method })
        }
        loading={markPaid.isPending}
      />
    </Screen>
  );
}
