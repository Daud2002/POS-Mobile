import { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Vibration } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Printer, ChefHat, BellRing } from 'lucide-react-native';

import { restaurantApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { Button, EmptyState, Text, useToast } from '@/components/ui';
import { useRealtime } from '@/hooks/useRealtime';
import { getSocket, RealtimeEvents } from '@/lib/socket';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { kitchenTicketFromOrder } from '@/features/printing/templates/kitchenTicket.template';
import { kitchenLines } from '@/lib/kitchen';
import { orderDestination, orderLabel, orderStatusLabel } from '@/lib/orderLabel';
import { tint, useTheme } from '@/theme';
import type { RestaurantOrder } from '@/api/types';
import { ConnectionBanner } from '../components/ConnectionBanner';

/** Three seconds of bell — six chimes — bundled so it plays offline. */
const RING = require('../../../../assets/sounds/new-order.wav');

/**
 * Buzz alongside the bell for the same three seconds: a kitchen is loud, and
 * a tablet lying on a steel counter is felt before it is heard.
 */
const RING_VIBRATION = [0, 400, 100, 400, 100, 400, 100, 400, 100, 400, 100, 400];

/**
 * The kitchen board.
 *
 * Shows and prints only what the kitchen COOKS. Drinks are billed on the
 * order like anything else but are poured at the counter, so the server
 * stamps them `skipKitchen` and this screen leaves them out of every card and
 * every ticket. An order or a round made of drinks alone never appears here
 * at all — the server never puts it on the board, and the events it raises
 * carry no kitchen lines, which is the signal to stay silent.
 *
 * Every new ticket rings the bell for three seconds, through the silent
 * switch: a kitchen device on mute is a kitchen that misses orders.
 */
export function KitchenScreen() {
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { printKitchenTicket, hasPrinter } = usePrinter();

  /** Orders auto-printed this session, so a refetch never reprints one. */
  const printed = useRef(new Set<string>());

  const bell = useAudioPlayer(RING);

  useEffect(() => {
    // Ring even when the phone's ringer switch is off.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const ring = useCallback(() => {
    try {
      bell.volume = 1;
      void bell.seekTo(0);
      bell.play();
    } catch {
      // No audio hardware, or the module is missing from an older build:
      // the vibration and the toast still announce the ticket.
    }
    Vibration.vibrate(RING_VIBRATION);
  }, [bell]);

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
      RealtimeEvents.orderItemsRemoved,
    ],
    onChange: refresh,
  });

  const print = useCallback(
    async (
      order: RestaurantOrder,
      variant: 'new' | 'additional' | 'reprint' | 'cancelled',
      items?: RestaurantOrder['items'],
    ) => {
      if (!hasPrinter) return;
      const ticket = kitchenTicketFromOrder(order as any, { variant, items: items as any });
      // Nothing to cook, nothing to print — a drinks-only order or round.
      if (!ticket.items.length) return;
      const result = await printKitchenTicket(ticket);
      // Printing never blocks the queue — the order is already on screen.
      if (!result.ok) toast.error(result.error ?? 'Ticket printing failed');
    },
    [hasPrinter, printKitchenTicket, toast],
  );

  useEffect(() => {
    const socket = getSocket();

    const onCreated = (order: RestaurantOrder) => {
      // Drinks only: the server opened it ready to bill, and it is not ours.
      if (!kitchenLines(order?.items).length) return;
      toast.info(`${order.waiterName ?? 'A waiter'} sent an order for ${orderDestination(order)}`);
      ring();
      if (!printed.current.has(order.id)) {
        printed.current.add(order.id);
        void print(order, 'new');
      }
    };

    const onItemsAdded = (payload: { order: RestaurantOrder; newItems: RestaurantOrder['items'] }) => {
      if (!payload?.order || !kitchenLines(payload.newItems).length) return;
      toast.info(`${payload.order.waiterName ?? 'A waiter'} added a round for ${payload.order.tableName ?? 'an order'}`);
      ring();
      // Only the new lines — reprinting everything would double-cook round one.
      void print(payload.order, 'additional', payload.newItems);
    };

    /**
     * The cashier struck dishes off an order still on the board. The server
     * only raises this for lines the kitchen was cooking, so every ticket
     * here is one to act on: stop making what it lists.
     */
    const onItemsRemoved = (payload: { order: RestaurantOrder; removedItems: RestaurantOrder['items'] }) => {
      if (!payload?.order || !kitchenLines(payload.removedItems).length) return;
      toast.info(`Items cancelled on ${orderDestination(payload.order)}`);
      ring();
      void print(payload.order, 'cancelled', payload.removedItems);
    };

    socket.on(RealtimeEvents.orderCreated, onCreated);
    socket.on(RealtimeEvents.orderItemsAdded, onItemsAdded);
    socket.on(RealtimeEvents.orderItemsRemoved, onItemsRemoved);
    return () => {
      socket.off(RealtimeEvents.orderCreated, onCreated);
      socket.off(RealtimeEvents.orderItemsAdded, onItemsAdded);
      socket.off(RealtimeEvents.orderItemsRemoved, onItemsRemoved);
    };
  }, [print, ring, toast]);

  /**
   * The kitchen's two moves. `handed_over` is where its authority ends: the
   * food is out, but the order stays live and holds its table until the
   * cashier takes payment.
   */
  const moveTo = async (
    order: RestaurantOrder,
    orderStatus: 'preparing' | 'handed_over',
  ) => {
    try {
      await restaurantApi.setStatus(order.id, orderStatus);
      if (orderStatus === 'handed_over') {
        toast.success('Handed over — the cashier can now take payment');
      }
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

        <View style={styles.headerRow}>
          <Text variant="h2">Kitchen · {orders.length} open</Text>
          <Button
            size="sm"
            variant="outline"
            onPress={ring}
            icon={<BellRing size={16} color={theme.colors.foreground} />}
            label="Test bell"
          />
        </View>

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
                    {orderDestination(order)}
                  </Text>
                  <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                    {orderLabel(order)} · {order.waiterName ?? 'Unknown'} ·{' '}
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </Text>
                  {/* A dine-out order eats in AND takes a parcel, so the
                      kitchen has to box part of it. */}
                  {order.orderType === 'dine_out' ? (
                    <Text variant="caption" style={{ color: theme.colors.info }}>
                      Dine-out — pack the parcel items
                    </Text>
                  ) : null}
                </View>
                <Text
                  variant="caption"
                  style={{
                    color:
                      order.orderStatus === 'requested'
                        ? theme.colors.warning
                        : theme.colors.info,
                  }}
                >
                  {orderStatusLabel(order.orderStatus)}
                </Text>
              </View>

              <View style={{ gap: 4 }}>
                {kitchenLines(order.items).map((item) => (
                  <View key={item.id}>
                    <Text variant="body">
                      <Text variant="bodySemibold">{item.quantity} × </Text>
                      {item.productName}
                      {/* Which dishes to box on a dine-out order. */}
                      {item.isParcel ? (
                        <Text variant="caption" style={{ color: theme.colors.info }}>
                          {'  '}PARCEL
                        </Text>
                      ) : null}
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
                  <Button
                    style={{ flex: 1 }}
                    onPress={() => moveTo(order, 'preparing')}
                    label="Start preparing"
                  />
                )}
                {order.orderStatus === 'preparing' && (
                  <Button
                    style={{ flex: 1 }}
                    onPress={() => moveTo(order, 'handed_over')}
                    label="Handed over"
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  card: { borderWidth: 1, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
