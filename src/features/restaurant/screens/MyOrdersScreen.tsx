import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ClipboardList, Plus, ChevronDown, ShoppingBag, BadgeCheck } from 'lucide-react-native';

import { restaurantApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import type { RestaurantOrder } from '@/api/types';
import type { RestaurantTabParamList } from '@/app/navigation/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { Screen } from '@/components/layout';
import { Button, EmptyState, FilterPillRow, Text } from '@/components/ui';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { timeLabel } from '@/lib/date';
import { toNumber } from '@/lib/format';
import { orderDestination, orderDisplayStatus, orderLabel, orderStatusLabel } from '@/lib/orderLabel';
import { tint, useTheme } from '@/theme';
import { ConnectionBanner } from '../components/ConnectionBanner';

type Scope = 'mine' | 'all';

const SCOPES = [
  { value: 'mine', label: 'My tables' },
  { value: 'all', label: 'All tables' },
] as const;

/**
 * The waiter's open orders, one card per table.
 *
 * The Tables tab is built for TAKING an order — pick a table, tap through the
 * menu — and gives no view of what has already gone to the kitchen. This is
 * that view: which of this waiter's tables are live, what each has ordered,
 * where the kitchen is with it, and a way to add the next round without
 * hunting for the table on the grid.
 *
 * "Mine" is the default because a waiter looks after their own tables; "All"
 * is there for covering someone else's section.
 */
export function MyOrdersScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();
  const navigation = useNavigation<BottomTabNavigationProp<RestaurantTabParamList, 'MyOrders'>>();

  const [scope, setScope] = useState<Scope>('mine');
  const [expanded, setExpanded] = useState<string | null>(null);

  const liveQuery = useQuery({
    queryKey: queryKeys.restaurantOrders('live'),
    // handed_over included: the food is out but the table is still taken, so
    // the waiter must still be able to add a round to it.
    queryFn: () => restaurantApi.listOrders({ orderStatus: 'requested,preparing,handed_over' }),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  const { connected } = useRealtime({
    events: [
      RealtimeEvents.orderCreated,
      RealtimeEvents.orderUpdated,
      RealtimeEvents.orderItemsAdded,
      RealtimeEvents.tableUpdated,
    ],
    onChange: refresh,
  });

  const orders = useMemo(() => {
    const all = liveQuery.data ?? [];
    const seated = all.filter((o) => o.tableId);
    const mine = scope === 'mine' ? seated.filter((o) => o.createdById === user?.id) : seated;
    // The table the waiter opened first sits first — the order they have
    // been looking after longest.
    return [...mine].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [liveQuery.data, scope, user?.id]);

  const statusColor = (order: RestaurantOrder) => {
    const status = orderDisplayStatus(order);
    if (status === 'requested') return theme.colors.warning;
    if (status === 'preparing') return theme.colors.info;
    return theme.colors.success;
  };

  /** Hands the order to the Tables tab, which opens the menu as a new round. */
  const addItems = (order: RestaurantOrder) =>
    navigation.navigate('Tables', { appendToOrderId: order.id });

  return (
    <Screen scrollable refreshing={liveQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 12 }}>
        <ConnectionBanner connected={connected} />

        <Text variant="h2">My Orders</Text>
        <Text variant="caption" color="mutedForeground">
          {orders.length} open table{orders.length === 1 ? '' : 's'}. Tap one to see what has
          been ordered, or add the next round.
        </Text>

        <FilterPillRow options={SCOPES} value={scope} onChange={setScope} scrollable={false} />

        {orders.length === 0 && !liveQuery.isLoading ? (
          <EmptyState
            icon={<ClipboardList size={28} color={theme.colors.mutedForeground} />}
            title={scope === 'mine' ? 'No open tables of yours' : 'No open tables'}
            description="Orders you send from the Tables tab appear here until they are paid."
          />
        ) : (
          orders.map((order) => {
            const open = expanded === order.id;
            const printed = !!order.billPrinted;
            return (
              <Pressable
                key={order.id}
                onPress={() => setExpanded(open ? null : order.id)}
                style={[
                  styles.card,
                  {
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.card,
                    borderColor: printed ? tint(theme.colors.success, 0.6) : theme.colors.border,
                  },
                ]}
              >
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySemibold" numberOfLines={1}>
                      {orderDestination(order)}
                      <Text variant="caption" color="mutedForeground">
                        {'  '}{orderLabel(order)}
                      </Text>
                      {order.orderType === 'dine_out' ? (
                        <Text variant="caption" style={{ color: theme.colors.info }}>
                          {'  '}dine-out
                        </Text>
                      ) : null}
                    </Text>
                    <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                      {order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? '' : 's'} ·
                      opened {timeLabel(order.createdAt)}
                      {scope === 'all' && order.waiterName ? ` · ${order.waiterName}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text variant="bodySemibold">{format(toNumber(order.total))}</Text>
                    <Text variant="caption" style={{ color: statusColor(order) }}>
                      {orderStatusLabel(orderDisplayStatus(order))}
                    </Text>
                  </View>
                  <ChevronDown
                    size={16}
                    color={theme.colors.mutedForeground}
                    style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                  />
                </View>

                {open && (
                  <View style={{ gap: 6, paddingTop: 8 }}>
                    {(order.items ?? []).map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        <Text variant="body" style={{ flex: 1 }}>
                          {item.quantity} × {item.productName}
                          {item.isParcel ? (
                            <Text variant="caption" style={{ color: theme.colors.info }}>
                              {'  '}(parcel)
                            </Text>
                          ) : null}
                          {item.skipKitchen ? (
                            <Text variant="caption" color="mutedForeground">
                              {'  '}counter
                            </Text>
                          ) : null}
                          {item.notes ? (
                            <Text variant="caption" style={{ color: theme.colors.warning }}>
                              {'  '}— {item.notes}
                            </Text>
                          ) : null}
                        </Text>
                        <Text variant="body">{format(toNumber(item.total))}</Text>
                      </View>
                    ))}

                    {printed && (
                      <View
                        style={[
                          styles.notice,
                          { backgroundColor: tint(theme.colors.success, 0.12), borderRadius: theme.radius.md },
                        ]}
                      >
                        <BadgeCheck size={14} color={theme.colors.success} />
                        <Text variant="caption" style={{ flex: 1 }}>
                          The bill has been printed
                          {order.billPrintedByName ? ` by ${order.billPrintedByName}` : ''}.
                          Adding more will need it reprinted.
                        </Text>
                      </View>
                    )}

                    <Button
                      size="sm"
                      onPress={() => addItems(order)}
                      icon={<Plus size={16} color={theme.colors.primaryForeground} />}
                      label="Add items to this order"
                      style={{ marginTop: 4 }}
                    />
                  </View>
                )}
              </Pressable>
            );
          })
        )}

        {orders.some((o) => o.orderType === 'dine_out') && (
          <View style={styles.legend}>
            <ShoppingBag size={12} color={theme.colors.info} />
            <Text variant="caption" color="mutedForeground">
              dine-out: some items on the order are packed to go.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginTop: 6 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
