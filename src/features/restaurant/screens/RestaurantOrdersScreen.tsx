import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, ChevronDown } from 'lucide-react-native';

import { restaurantApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { Button, EmptyState, SearchInput, Text } from '@/components/ui';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { useDebouncedValue } from '@/hooks/useDebouncedCallback';
import { RealtimeEvents } from '@/lib/socket';
import { toNumber } from '@/lib/format';
import { orderDestination, orderLabel, orderStatusLabel } from '@/lib/orderLabel';
import { tint, useTheme } from '@/theme';
import type { RestaurantOrder } from '@/api/types';
import { ConnectionBanner } from '../components/ConnectionBanner';

/** Full history, unlike the Cashier screen which only lists what is still open. */
const FILTERS = [
  { key: 'all', label: 'All', statuses: undefined },
  // handed_over is still open: the food is out, but nobody has paid.
  { key: 'open', label: 'Open', statuses: 'requested,preparing,handed_over' },
  { key: 'ready', label: 'Ready to bill', statuses: 'handed_over' },
  { key: 'draft', label: 'Drafts', statuses: 'draft' },
  { key: 'completed', label: 'Completed', statuses: 'completed' },
  { key: 'cancelled', label: 'Cancelled', statuses: 'cancelled' },
] as const;

export function RestaurantOrdersScreen() {
  const theme = useTheme();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [expanded, setExpanded] = useState<string | null>(null);

  const statuses = FILTERS.find((f) => f.key === filter)?.statuses;

  const PAGE_SIZE = 20;

  /**
   * Paged with "Load more" rather than prev/next: on a phone, appending is the
   * natural gesture, and a cashier scanning back through history should not
   * lose their place by paging away from it.
   */
  const ordersQuery = useInfiniteQuery({
    // The search term is part of the key, so a new term starts a fresh list
    // rather than appending onto results for the previous one.
    queryKey: [...queryKeys.restaurantOrders(filter), debouncedSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      restaurantApi.listOrdersPaged(
        { orderStatus: statuses, search: debouncedSearch || undefined },
        { skip: pageParam as number, take: PAGE_SIZE },
      ),
    getNextPageParam: (last) => {
      const loaded = last.skip + last.items.length;
      return loaded < last.total ? loaded : undefined;
    },
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  const { connected } = useRealtime({
    events: [
      RealtimeEvents.orderCreated,
      RealtimeEvents.orderUpdated,
      RealtimeEvents.orderItemsAdded,
      RealtimeEvents.draftUpdated,
    ],
    onChange: refresh,
  });

  const orders = ordersQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const total = ordersQuery.data?.pages[0]?.total ?? 0;

  // Searched by the API, so the screen shows exactly what came back.
  const visible = orders;

  // Only settled orders represent money actually taken.
  const settledTotal = useMemo(
    () =>
      visible
        .filter((o) => o.orderStatus === 'completed')
        .reduce((sum, o) => sum + toNumber(o.total), 0),
    [visible],
  );

  const statusColor = (status: RestaurantOrder['orderStatus']) => {
    if (status === 'requested') return theme.colors.warning;
    if (status === 'preparing') return theme.colors.info;
    // Cooked and on the floor — the cashier's cue, so it reads as ready
    // rather than as another in-progress state.
    if (status === 'handed_over') return theme.colors.success;
    if (status === 'completed') return theme.colors.success;
    if (status === 'cancelled') return theme.colors.destructive;
    return theme.colors.mutedForeground;
  };

  return (
    <Screen scrollable refreshing={ordersQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 12 }}>
        <ConnectionBanner connected={connected} />

        <Text variant="h2">Orders</Text>
        <Text variant="caption" color="mutedForeground">
          {total} orders · {format(settledTotal)} settled in what is loaded
        </Text>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search #, table, customer, waiter…"
        />

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterPill,
                {
                  borderRadius: theme.radius.full,
                  borderColor: filter === f.key ? theme.colors.primary : theme.colors.border,
                  backgroundColor:
                    filter === f.key ? tint(theme.colors.primary, 0.1) : 'transparent',
                },
              ]}
            >
              <Text variant="caption">{f.label}</Text>
            </Pressable>
          ))}
        </View>

        {visible.length === 0 && !ordersQuery.isLoading ? (
          <EmptyState
            icon={<ClipboardList size={28} color={theme.colors.mutedForeground} />}
            title="No orders"
            description="Nothing matches this filter yet."
          />
        ) : (
          visible.map((order) => {
            const open = expanded === order.id;
            return (
              <Pressable
                key={order.id}
                onPress={() => setExpanded(open ? null : order.id)}
                style={[
                  styles.card,
                  {
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySemibold" numberOfLines={1}>
                      {orderLabel(order)} · {orderDestination(order)}
                      {/* A dine-out order sits at a table, so the destination
                          alone would not reveal that it also had a parcel. */}
                      {order.orderType === 'dine_out' && order.tableName ? (
                        <Text variant="caption" style={{ color: theme.colors.info }}>
                          {'  '}dine-out
                        </Text>
                      ) : null}
                    </Text>
                    <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                      {order.waiterName ?? '—'} · {new Date(order.createdAt).toLocaleString()}
                      {order.settledByName ? ` · paid to ${order.settledByName}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text variant="bodySemibold">{format(toNumber(order.total))}</Text>
                    <Text
                      variant="caption"
                      style={{ color: statusColor(order.orderStatus) }}
                    >
                      {orderStatusLabel(order.orderStatus)}
                    </Text>
                  </View>
                  <ChevronDown
                    size={16}
                    color={theme.colors.mutedForeground}
                    style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                  />
                </View>

                {open && (
                  <View style={{ gap: 4, paddingTop: 8 }}>
                    {(order.items ?? []).map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        <Text variant="body" style={{ flex: 1 }}>
                          {item.quantity} × {item.productName}
                          {item.isParcel ? (
                            <Text variant="caption" style={{ color: theme.colors.info }}>
                              {'  '}(parcel)
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

                    <View style={[styles.divider, { borderColor: theme.colors.border }]} />
                    <View style={styles.itemRow}>
                      <Text variant="caption" color="mutedForeground">Subtotal</Text>
                      <Text variant="caption">{format(toNumber(order.subtotal))}</Text>
                    </View>
                    {toNumber(order.discount) > 0 && (
                      <View style={styles.itemRow}>
                        <Text variant="caption" style={{ color: theme.colors.destructive }}>
                          Discount
                          {order.discountType === 'percent' && order.discountValue
                            ? ` (${toNumber(order.discountValue)}%)`
                            : ''}
                        </Text>
                        <Text variant="caption" style={{ color: theme.colors.destructive }}>
                          -{format(toNumber(order.discount))}
                        </Text>
                      </View>
                    )}
                    <View style={styles.itemRow}>
                      <Text variant="bodySemibold">Total</Text>
                      <Text variant="bodySemibold">{format(toNumber(order.total))}</Text>
                    </View>
                    <Text variant="caption" color="mutedForeground">
                      Payment: {order.paymentStatus ?? order.status}
                      {order.paymentMethod ? ` · ${order.paymentMethod}` : ''}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}

        {ordersQuery.hasNextPage && (
          <Button
            variant="outline"
            onPress={() => ordersQuery.fetchNextPage()}
            loading={ordersQuery.isFetchingNextPage}
            label={`Load more (${orders.length} of ${total})`}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterPill: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  card: { borderWidth: 1, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 6 },
});
