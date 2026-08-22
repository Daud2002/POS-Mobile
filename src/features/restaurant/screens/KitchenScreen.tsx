import { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, ChefHat } from 'lucide-react-native';

import { restaurantApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { Button, EmptyState, Text, useToast } from '@/components/ui';
import { useRealtime } from '@/hooks/useRealtime';
import { getSocket, RealtimeEvents } from '@/lib/socket';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { kitchenTicketFromOrder } from '@/features/printing/templates/kitchenTicket.template';
import { orderLabel } from '@/lib/orderLabel';
import { tint, useTheme } from '@/theme';
import type { RestaurantOrder } from '@/api/types';
import { ConnectionBanner } from '../components/ConnectionBanner';

export function KitchenScreen() {
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { printKitchenTicket, hasPrinter } = usePrinter();

  /** Orders auto-printed this session, so a refetch never reprints one. */
  const printed = useRef(new Set<string>());

  const ordersQuery = useQuery({
    queryKey: queryKeys.restaurantOrders('live'),
    queryFn: () => restaurantApi.listOrders({ orderStatus: 'requested,preparing' }),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  const { connected } = useRealtime({
    events: [
      RealtimeEvents.orderCreated,
      RealtimeEvents.orderUpdated,
      RealtimeEvents.orderItemsAdded,
    ],
    onChange: refresh,
  });

  const print = useCallback(
    async (
      order: RestaurantOrder,
      variant: 'new' | 'additional' | 'reprint',
      items?: RestaurantOrder['items'],
    ) => {
      if (!hasPrinter) return;
      const result = await printKitchenTicket(
        kitchenTicketFromOrder(order as any, { variant, items: items as any }),
      );
      // Printing never blocks the queue — the order is already on screen.
      if (!result.ok) toast.error(result.error ?? 'Ticket printing failed');
    },
    [hasPrinter, printKitchenTicket, toast],
  );

  useEffect(() => {
    const socket = getSocket();

    const onCreated = (order: RestaurantOrder) => {
      toast.info(`${order.waiterName ?? 'A waiter'} sent an order for ${order.tableName ?? 'takeaway'}`);
      if (!printed.current.has(order.id)) {
        printed.current.add(order.id);
        void print(order, 'new');
      }
    };

    const onItemsAdded = (payload: { order: RestaurantOrder; newItems: RestaurantOrder['items'] }) => {
      if (!payload?.order) return;
      toast.info(`${payload.order.waiterName ?? 'A waiter'} added a round for ${payload.order.tableName ?? 'an order'}`);
      // Only the new lines — reprinting everything would double-cook round one.
      void print(payload.order, 'additional', payload.newItems);
    };

    socket.on(RealtimeEvents.orderCreated, onCreated);
    socket.on(RealtimeEvents.orderItemsAdded, onItemsAdded);
    return () => {
      socket.off(RealtimeEvents.orderCreated, onCreated);
      socket.off(RealtimeEvents.orderItemsAdded, onItemsAdded);
    };
  }, [print, toast]);

  const setPreparing = async (order: RestaurantOrder) => {
    try {
      await restaurantApi.setStatus(order.id, 'preparing');
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to update status');
    }
  };

  const orders = ordersQuery.data ?? [];

  return (
    <Screen scrollable refreshing={ordersQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 12 }}>
        <ConnectionBanner connected={connected} />

        <Text variant="h2">Kitchen · {orders.length} open</Text>

        {orders.length === 0 && !ordersQuery.isLoading ? (
          <EmptyState
            icon={<ChefHat size={28} color={theme.colors.mutedForeground} />}
            title="No open orders"
            description="New tickets appear here automatically."
          />
        ) : (
          orders.map((order) => (
            <View
              key={order.id}
              style={[
                styles.card,
                {
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.card,
                  borderColor:
                    order.orderStatus === 'requested'
                      ? tint(theme.colors.warning, 0.5)
                      : theme.colors.border,
                },
              ]}
            >
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySemibold" numberOfLines={1}>
                    {order.tableName ??
                      (order.orderType === 'delivery' ? 'Delivery' : 'Takeaway')}
                  </Text>
                  <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                    {orderLabel(order)} · {order.waiterName ?? 'Unknown'} ·{' '}
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </Text>
                </View>
                <Text
                  variant="caption"
                  style={{
                    color:
                      order.orderStatus === 'requested'
                        ? theme.colors.warning
                        : theme.colors.info,
                    textTransform: 'capitalize',
                  }}
                >
                  {order.orderStatus}
                </Text>
              </View>

              <View style={{ gap: 4 }}>
                {(order.items ?? []).map((item) => (
                  <View key={item.id}>
                    <Text variant="body">
                      <Text variant="bodySemibold">{item.quantity} × </Text>
                      {item.productName}
                    </Text>
                    {item.notes ? (
                      <Text variant="caption" style={{ color: theme.colors.warning, paddingLeft: 16 }}>
                        ** {item.notes}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>

              <View style={styles.actions}>
                {order.orderStatus === 'requested' && (
                  <Button style={{ flex: 1 }} onPress={() => setPreparing(order)}
                  label="Start preparing"
                />
                )}
                <Button
                  variant="outline"
                  onPress={() => print(order, 'reprint')}
                  icon={<Printer size={16} color={theme.colors.foreground} />}
                  label="Reprint"
                />
              </View>
            </View>
          ))
        )}

        {!hasPrinter && (
          <Text variant="caption" color="mutedForeground">
            No printer paired. Tickets still appear here — pair one in Settings › Printer to
            print them automatically.
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
