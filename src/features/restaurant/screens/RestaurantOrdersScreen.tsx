import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, ChevronDown, Printer } from 'lucide-react-native';

import { restaurantApi, storesApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import type { OrderEvent, RestaurantOrder } from '@/api/types';
import { Screen } from '@/components/layout';
import { Button, EmptyState, SearchInput, Text, useToast } from '@/components/ui';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { receiptFromRestaurantOrder } from '@/features/printing/templates/receiptFromOrder';
import { useStoreId } from '@/hooks/useStoreId';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { useDebouncedValue } from '@/hooks/useDebouncedCallback';
import { RealtimeEvents } from '@/lib/socket';
import { toNumber } from '@/lib/format';
import {
  orderDestination, orderDisplayStatus, orderLabel, orderStatusLabel,
} from '@/lib/orderLabel';
import { paymentSummary } from '@/lib/payment';
import { countsAsRevenue, isCreditOwing, isCreditSale } from '@/lib/creditSales';
import { tint, useTheme } from '@/theme';
import { ConnectionBanner } from '../components/ConnectionBanner';

const timeOf = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * An order's history, oldest first: the original order, then every change
 * and every print with who did it. Fetched only once the card is open — the
 * list is paged and most orders are never expanded.
 */
function OrderHistory({ orderId, format }: { orderId: string; format: (n: number) => string }) {
  const theme = useTheme();
  const history = useQuery({
    queryKey: queryKeys.restaurantOrderHistory(orderId),
    queryFn: () => restaurantApi.history(orderId),
  });
  const events = history.data?.events ?? [];

  const toneOf = (event: OrderEvent) =>
    event.type === 'items_added'
      ? theme.colors.success
      : event.type === 'items_removed'
        ? theme.colors.destructive
        : theme.colors.foreground;
  const headingOf = (event: OrderEvent) =>
    event.type === 'placed' ? 'Original order' : event.type === 'items_added' ? 'Added' : 'Removed';

  return (
    <View style={[styles.history, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      <Text variant="caption" color="mutedForeground" style={{ textTransform: 'uppercase' }}>
        History
      </Text>
      {history.isLoading ? (
        <Text variant="caption" color="mutedForeground">Loading…</Text>
      ) : history.isError ? (
        <Text variant="caption" style={{ color: theme.colors.destructive }}>
          Could not load the history.
        </Text>
      ) : events.length === 0 ? (
        <Text variant="caption" color="mutedForeground">
          No history recorded for this order.
        </Text>
      ) : (
        events.map((event) =>
          event.type === 'bill_printed' ? (
            <View key={event.id} style={styles.historyPrint}>
              <Printer size={12} color={theme.colors.mutedForeground} />
              <Text variant="caption" color="mutedForeground" style={{ flex: 1 }}>
                {event.payload?.reprint
                  ? `Bill reprinted (#${event.payload.printNumber ?? '?'})`
                  : 'Bill printed'}
                {' · '}{event.actorName ?? 'Unknown'} · {timeOf(event.createdAt)}
                {' · '}{format(toNumber(event.payload?.totals?.total))}
              </Text>
            </View>
          ) : (
            <View key={event.id}>
              <Text variant="caption" style={{ color: toneOf(event), fontWeight: '600' }}>
                {headingOf(event)}
                <Text variant="caption" color="mutedForeground">
                  {' · '}{event.actorName ?? 'Unknown'} · {timeOf(event.createdAt)}
                </Text>
              </Text>
              {(event.payload?.lines ?? []).map((line, i) => (
                <Text key={`${event.id}-${i}`} variant="caption" color="mutedForeground" style={{ paddingLeft: 12 }}>
                  {event.type === 'items_removed' ? '−' : event.type === 'items_added' ? '+' : ''}
                  {line.quantity} × {line.productName ?? 'Item'}
                  {line.isParcel ? ' (parcel)' : ''}
                  {line.notes ? ` — ${line.notes}` : ''}
                </Text>
              ))}
            </View>
          ),
        )
      )}
    </View>
  );
}

/** Full history, unlike the Cashier screen which only lists what is still open. */
const FILTERS: ReadonlyArray<{
  key: string;
  label: string;
  statuses?: string;
  billPrinted?: 'true' | 'false';
}> = [
  { key: 'all', label: 'All' },
  // handed_over is still open: the food is out, but nobody has paid.
  { key: 'open', label: 'Open', statuses: 'requested,preparing,handed_over' },
  { key: 'ready', label: 'Ready to bill', statuses: 'handed_over', billPrinted: 'false' },
  // The paper is out and the money is owed to a specific till.
  { key: 'printed', label: 'Bill printed', statuses: 'requested,preparing,handed_over', billPrinted: 'true' },
  { key: 'draft', label: 'Drafts', statuses: 'draft' },
  { key: 'completed', label: 'Completed', statuses: 'completed' },
  { key: 'cancelled', label: 'Cancelled', statuses: 'cancelled' },
];

export function RestaurantOrdersScreen() {
  const theme = useTheme();
  const toast = useToast();
  const storeId = useStoreId();
  const { format, currency } = useStoreCurrency();
  const queryClient = useQueryClient();
  const { printReceipt, hasPrinter } = usePrinter();

  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // The receipt header: name, address, phone.
  const storeQuery = useQuery({
    queryKey: queryKeys.store(storeId ?? ''),
    queryFn: () => storesApi.getById(storeId as string),
    enabled: !!storeId,
  });

  /**
   * Prints the bill from the list — a reprint for a settled order (the
   * customer wants their copy after paying), or the first print of a live
   * one. An empty body keeps whatever discount and delivery charge the order
   * already carries; on a settled order the server changes nothing but the
   * print count.
   */
  const printBill = async (order: RestaurantOrder) => {
    setPrintingId(order.id);
    try {
      const bill = await restaurantApi.printBill(order.id, {});
      const result = await printReceipt(
        receiptFromRestaurantOrder({
          order: bill,
          store: storeQuery.data,
          currency,
          isReprint: !!order.billPrinted,
        }),
      );
      if (result.ok) toast.success(order.billPrinted ? 'Bill reprinted' : 'Bill printed');
      else toast.error(result.error ?? 'Receipt printing failed');
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to print the bill');
    } finally {
      setPrintingId(null);
    }
  };

  const active = FILTERS.find((f) => f.key === filter);
  const statuses = active?.statuses;
  const billPrinted = active?.billPrinted;

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
        { orderStatus: statuses, billPrinted, search: debouncedSearch || undefined },
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
      RealtimeEvents.orderItemsRemoved,
      RealtimeEvents.draftUpdated,
    ],
    // Invalidates the whole 'restaurant' prefix, histories included.
    onChange: refresh,
  });

  const orders = ordersQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const total = ordersQuery.data?.pages[0]?.total ?? 0;

  // Searched by the API, so the screen shows exactly what came back.
  const visible = orders;

  // Only settled orders represent money actually taken — a credit sale
  // nobody has collected yet is completed but not money.
  const settledTotal = useMemo(
    () =>
      visible
        .filter(countsAsRevenue)
        .reduce((sum, o) => sum + toNumber(o.total), 0),
    [visible],
  );

  const statusColor = (status: string) => {
    if (status === 'requested') return theme.colors.warning;
    if (status === 'preparing') return theme.colors.info;
    // Cooked and on the floor — the cashier's cue, so it reads as ready
    // rather than as another in-progress state.
    if (status === 'handed_over') return theme.colors.success;
    if (status === 'bill_printed') return theme.colors.success;
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
                      {/* A table order with parcels still shows its table, so
                          the destination alone would not reveal the parcel. */}
                      {order.orderType === 'dine_out' && order.tableName ? (
                        <Text variant="caption" style={{ color: theme.colors.info }}>
                          {'  '}parcel
                        </Text>
                      ) : null}
                      {/* Served, but the customer took it on credit. */}
                      {isCreditSale(order) ? (
                        <Text
                          variant="caption"
                          style={{ color: isCreditOwing(order) ? theme.colors.warning : theme.colors.success }}
                        >
                          {'  '}credit{isCreditOwing(order) ? ' · unpaid' : ''}
                        </Text>
                      ) : null}
                    </Text>
                    <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                      {order.waiterName ?? '—'} · {new Date(order.createdAt).toLocaleString()}
                      {order.settledByName ? ` · paid to ${order.settledByName}` : ''}
                      {/* Whose till holds the paper, while it is still unpaid. */}
                      {!order.settledByName && order.billPrinted && order.billPrintedByName
                        ? ` · bill by ${order.billPrintedByName}`
                        : ''}
                    </Text>
                    {/* A bill that came out more than once is worth a second look. */}
                    {toNumber(order.reprintCount) > 0 ? (
                      <Text variant="caption" style={{ color: theme.colors.warning }}>
                        Reprinted ×{toNumber(order.reprintCount)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text variant="bodySemibold">{format(toNumber(order.total))}</Text>
                    <Text
                      variant="caption"
                      style={{ color: statusColor(orderDisplayStatus(order)) }}
                    >
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
                    {toNumber(order.deliveryCharge) > 0 && (
                      <View style={styles.itemRow}>
                        <Text variant="caption" color="mutedForeground">Delivery charges</Text>
                        <Text variant="caption">{format(toNumber(order.deliveryCharge))}</Text>
                      </View>
                    )}
                    <View style={styles.itemRow}>
                      <Text variant="bodySemibold">Total</Text>
                      <Text variant="bodySemibold">{format(toNumber(order.total))}</Text>
                    </View>
                    <Text variant="caption" color="mutedForeground">
                      Payment: {order.paymentStatus ?? order.status}
                      {isCreditSale(order) ? ' (credit)' : ''}
                      {order.paymentStatus === 'paid' && paymentSummary(order, format)
                        ? ` · ${paymentSummary(order, format)}`
                        : ''}
                    </Text>

                    {/* Drafts have no bill yet and a cancelled order never will. */}
                    {order.orderStatus !== 'draft' && order.orderStatus !== 'cancelled' ? (
                      <View style={{ marginTop: 6, gap: 4 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Printer size={16} color={theme.colors.foreground} />}
                          label={order.billPrinted ? 'Reprint bill' : 'Print bill'}
                          loading={printingId === order.id}
                          disabled={!hasPrinter || printingId === order.id}
                          onPress={() => void printBill(order)}
                        />
                        {!hasPrinter ? (
                          <Text variant="caption" color="mutedForeground">
                            Pair a printer in Settings to print bills from here.
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    <OrderHistory orderId={order.id} format={format} />
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
  history: { borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 6, marginTop: 8 },
  historyPrint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
