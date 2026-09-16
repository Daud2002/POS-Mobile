import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, StyleSheet, Vibration, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
import type { RestaurantOrder, RestaurantOrderItem } from '@/api/types';
import { ConnectionBanner } from '../components/ConnectionBanner';

/** Three seconds of bell — six chimes — bundled so it plays offline. */
const RING = require('../../../../assets/sounds/new-order.wav');

/**
 * Buzz alongside the bell for the same three seconds: a kitchen is loud, and
 * a tablet lying on a steel counter is felt before it is heard.
 */
const RING_VIBRATION = [0, 400, 100, 400, 100, 400, 100, 400, 100, 400, 100, 400];

/** The card flashes for exactly as long as the bell rings for it. */
const FLASH_MS = 3000;

/**
 * What has changed on an order since its first ticket.
 *
 * Kept on the client, because the server's order no longer holds a line the
 * cashier struck off — the board is the only place the kitchen can still be
 * shown it. Both lists live until the order leaves the board, so a chef who
 * looks up a minute after the bell still sees what moved.
 */
interface OrderChanges {
  /** Ids of lines that arrived as a later round. Drawn with a NEW tag. */
  addedIds: string[];
  /** Lines struck off, with how many came off. Drawn crossed out. */
  removed: RestaurantOrderItem[];
}

const NO_CHANGES: OrderChanges = { addedIds: [], removed: [] };

/**
 * Folds struck-off lines into the record, merging a line removed twice (one
 * off now, one off later) into a single crossed-out entry with the sum.
 */
function mergeRemoved(
  existing: RestaurantOrderItem[],
  incoming: RestaurantOrderItem[],
): RestaurantOrderItem[] {
  const merged = [...existing];
  for (const item of incoming) {
    const at = merged.findIndex((r) => r.id === item.id);
    if (at >= 0) {
      merged[at] = {
        ...merged[at],
        quantity: Number(merged[at].quantity) + Number(item.quantity),
      };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

/**
 * A card that pulses its opacity while `active` — the visual half of the
 * bell, so the chef can see which order it rang for. Snaps back to solid the
 * moment it stops, so a card is never left half-faded.
 */
function FlashCard({
  active,
  style,
  children,
}: {
  active: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(withTiming(0.3, { duration: 300 }), -1, true);
    } else {
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: 150 });
    }
  }, [active, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

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
 * switch: a kitchen device on mute is a kitchen that misses orders. The card
 * it rang for flashes for the same three seconds, so the chef can see WHICH.
 *
 * A change to an order already on the board — a waiter's further round, a
 * line the cashier struck off — is shown on the card itself: new lines carry
 * a NEW tag and removed lines stay on the card crossed out, until the order
 * leaves the board.
 */
export function KitchenScreen() {
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { printKitchenTicket, hasPrinter } = usePrinter();

  /** Orders auto-printed this session, so a refetch never reprints one. */
  const printed = useRef(new Set<string>());

  /** Orders whose card is flashing right now — the ones the bell rang for. */
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const flashTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Per order, what has changed since its first ticket. */
  const [changes, setChanges] = useState<Record<string, OrderChanges>>({});
  /** Which orders were on the board at the last fetch, to know which have left. */
  const onBoard = useRef(new Set<string>());

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

  /**
   * Flashes one card for as long as the bell rings. A second event for the
   * same order while it is still flashing simply restarts the clock.
   */
  const flash = useCallback((orderId: string) => {
    const pending = flashTimers.current.get(orderId);
    if (pending) clearTimeout(pending);
    setFlashing((prev) => new Set(prev).add(orderId));
    flashTimers.current.set(
      orderId,
      setTimeout(() => {
        flashTimers.current.delete(orderId);
        setFlashing((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }, FLASH_MS),
    );
  }, []);

  useEffect(() => () => flashTimers.current.forEach(clearTimeout), []);

  const noteAdded = useCallback((orderId: string, items: RestaurantOrderItem[]) => {
    setChanges((prev) => {
      const current = prev[orderId] ?? NO_CHANGES;
      return {
        ...prev,
        [orderId]: { ...current, addedIds: [...current.addedIds, ...items.map((i) => i.id)] },
      };
    });
  }, []);

  const noteRemoved = useCallback((orderId: string, items: RestaurantOrderItem[]) => {
    setChanges((prev) => {
      const current = prev[orderId] ?? NO_CHANGES;
      return { ...prev, [orderId]: { ...current, removed: mergeRemoved(current.removed, items) } };
    });
  }, []);

  const ordersQuery = useQuery({
    queryKey: queryKeys.restaurantOrders('live'),
    queryFn: () => restaurantApi.listOrders({ orderStatus: 'requested,preparing' }),
  });

  const orders = ordersQuery.data ?? [];

  /**
   * Forgets the changes of an order once it has left the board — handed over,
   * cancelled or settled. Compared against the PREVIOUS board rather than
   * simply "not in the list", because an event can land before the refetch
   * that puts its order on the board (a round that reopens a handed-over
   * order), and that record must survive until the card appears.
   */
  useEffect(() => {
    const now = new Set(orders.map((o) => o.id));
    const gone = [...onBoard.current].filter((id) => !now.has(id));
    onBoard.current = now;
    if (!gone.length) return;
    setChanges((prev) => {
      const next = { ...prev };
      for (const id of gone) delete next[id];
      return next;
    });
  }, [orders]);

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
      flash(order.id);
      if (!printed.current.has(order.id)) {
        printed.current.add(order.id);
        void print(order, 'new');
      }
    };

    const onItemsAdded = (payload: { order: RestaurantOrder; newItems: RestaurantOrder['items'] }) => {
      const cooked = kitchenLines(payload?.newItems);
      if (!payload?.order || !cooked.length) return;
      toast.info(`${payload.order.waiterName ?? 'A waiter'} added a round for ${payload.order.tableName ?? 'an order'}`);
      ring();
      flash(payload.order.id);
      noteAdded(payload.order.id, cooked);
      // Only the new lines — reprinting everything would double-cook round one.
      void print(payload.order, 'additional', payload.newItems);
    };

    /**
     * The cashier struck dishes off an order still on the board. The server
     * only raises this for lines the kitchen was cooking, so every ticket
     * here is one to act on: stop making what it lists.
     */
    const onItemsRemoved = (payload: { order: RestaurantOrder; removedItems: RestaurantOrder['items'] }) => {
      const cooked = kitchenLines(payload?.removedItems);
      if (!payload?.order || !cooked.length) return;
      toast.info(`Items cancelled on ${orderDestination(payload.order)}`);
      ring();
      flash(payload.order.id);
      noteRemoved(payload.order.id, cooked);
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
  }, [print, ring, flash, noteAdded, noteRemoved, toast]);

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
          orders.map((order) => {
            const changed = changes[order.id];
            const addedIds = new Set(changed?.addedIds ?? []);
            const removed = changed?.removed ?? [];
            return (
              <FlashCard
                key={order.id}
                active={flashing.has(order.id)}
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
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
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
                    {/* Something on this ticket moved after it was first printed. */}
                    {changed ? (
                      <View style={[styles.tag, { backgroundColor: theme.colors.warning }]}>
                        <Text variant="caption" style={{ color: theme.colors.primaryForeground, fontWeight: '600' }}>
                          Updated
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={{ gap: 4 }}>
                  {kitchenLines(order.items).map((item) => (
                    <View key={item.id}>
                      <Text variant="body">
                        <Text variant="bodySemibold">{item.quantity} × </Text>
                        {item.productName}
                        {addedIds.has(item.id) ? (
                          <Text variant="caption" style={{ color: theme.colors.success, fontWeight: '600' }}>
                            {'  '}NEW
                          </Text>
                        ) : null}
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
                  {/* Struck off by the cashier: no longer on the order, still on
                      the card so the kitchen knows to stop making them. */}
                  {removed.map((item) => (
                    <Text key={`removed-${item.id}`} variant="body" color="mutedForeground">
                      <Text
                        variant="body"
                        color="mutedForeground"
                        style={{ textDecorationLine: 'line-through' }}
                      >
                        <Text variant="bodySemibold" color="mutedForeground">
                          {item.quantity} ×{' '}
                        </Text>
                        {item.productName}
                      </Text>
                      <Text variant="caption" style={{ color: theme.colors.destructive, fontWeight: '600' }}>
                        {'  '}REMOVED
                      </Text>
                    </Text>
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
              </FlashCard>
            );
          })
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
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
