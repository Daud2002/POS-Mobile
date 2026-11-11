import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ChevronDown, NotebookPen, Phone } from 'lucide-react-native';

import { restaurantApi, shiftsApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import type { CreditCustomer, RestaurantOrder } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { Screen } from '@/components/layout';
import { Button, EmptyState, FilterPillRow, SearchInput, Text, useToast } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedCallback';
import { useRealtime } from '@/hooks/useRealtime';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { isCreditOwing, sortCreditOrders } from '@/lib/creditSales';
import { displayDate, timeLabel } from '@/lib/date';
import { toNumber } from '@/lib/format';
import { orderDestination, orderLabel } from '@/lib/orderLabel';
import { paymentSummary } from '@/lib/payment';
import { tipWasDropped, type SettleBody } from '@/lib/tips';
import { effectiveRoleOf } from '@/lib/roles';
import { RealtimeEvents } from '@/lib/socket';
import { ShiftBar } from '@/features/shifts/components/ShiftBar';
import { tint, useTheme } from '@/theme';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { CollectCreditSheet } from '../components/CollectCreditSheet';

type Filter = 'owing' | 'all';

const FILTERS = [
  { value: 'owing', label: 'Owing' },
  { value: 'all', label: 'All customers' },
] as const;

const when = (value?: string | null) => (value ? `${displayDate(value)} ${timeLabel(value)}` : '—');

/**
 * One customer's credit orders, fetched when their row is first opened.
 * Unpaid at the top, then paid, each newest first.
 */
function CustomerOrders({
  customer,
  canCollect,
  shiftBlocked,
  onCollect,
}: {
  customer: CreditCustomer;
  canCollect: boolean;
  shiftBlocked: boolean;
  onCollect: (order: RestaurantOrder) => void;
}) {
  const theme = useTheme();
  const { format } = useStoreCurrency();
  const ordersQuery = useQuery({
    queryKey: queryKeys.creditCustomerOrders(customer.customerId),
    queryFn: () => restaurantApi.creditCustomerOrders(customer.customerId).then(sortCreditOrders),
  });

  if (ordersQuery.isLoading) {
    return (
      <Text variant="caption" color="mutedForeground" style={{ paddingVertical: 8 }}>
        Loading orders…
      </Text>
    );
  }
  const orders = ordersQuery.data ?? [];
  if (orders.length === 0) {
    return (
      <Text variant="caption" color="mutedForeground" style={{ paddingVertical: 8 }}>
        No credit orders.
      </Text>
    );
  }

  return (
    <View style={{ gap: 8, paddingTop: 10 }}>
      {orders.map((order) => {
        const unpaid = isCreditOwing(order);
        const summary = paymentSummary(order, format);
        return (
          <View
            key={order.id}
            style={[
              styles.order,
              { borderRadius: theme.radius.md, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
            ]}
          >
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodySemibold" numberOfLines={1}>
                  {orderLabel(order)}
                  <Text variant="caption" color="mutedForeground">
                    {'  '}
                    {orderDestination(order)} · {when(order.creditedAt)}
                  </Text>
                </Text>
                {(order.items ?? []).length > 0 ? (
                  <Text variant="caption" color="mutedForeground" numberOfLines={2}>
                    {(order.items ?? []).map((i) => `${toNumber(i.quantity)} × ${i.productName}`).join(', ')}
                  </Text>
                ) : null}
                <Text variant="caption" color="mutedForeground">
                  Credited by {order.creditedByName || '—'}
                  {!unpaid
                    ? ` · Paid ${when(order.settledAt)} to ${order.settledByName || '—'}${summary ? ` · ${summary}` : ''}`
                    : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text variant="bodySemibold">{format(toNumber(order.total))}</Text>
                <View
                  style={[
                    styles.badge,
                    {
                      borderRadius: 999,
                      backgroundColor: tint(unpaid ? theme.colors.warning : theme.colors.success, 0.15),
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: unpaid ? theme.colors.warning : theme.colors.success }}>
                    {unpaid ? 'Unpaid' : 'Paid'}
                  </Text>
                </View>
              </View>
            </View>
            {unpaid && canCollect ? (
              <Button
                size="sm"
                onPress={() => onCollect(order)}
                disabled={shiftBlocked}
                icon={<BadgeCheck size={16} color={theme.colors.primaryForeground} />}
                label={shiftBlocked ? 'Open your shift to mark paid' : 'Mark paid'}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Credit Sales: who owes the restaurant, and for what. Mirrors the web's
 * CreditSalesPage.
 *
 * One row per customer who has ever bought on credit — the ones who still
 * owe first. Opening a row lists their credit orders. A cashier or
 * supervisor marks one paid when the customer settles up; the money goes on
 * THEIR open shift and counts in today's sales. The owner sees the book but
 * does not collect from it.
 */
export function CreditSalesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { user, refresh: refreshProfile } = useAuth();

  // Which tips are recorded rides on the profile; re-read it on every visit
  // so a switch the owner just flipped shows in the payment sheet.
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const role = effectiveRoleOf(user);
  const staff = role === 'cashier' || role === 'supervisor';

  const shiftQuery = useQuery({
    queryKey: queryKeys.currentShift(),
    queryFn: () => shiftsApi.current(),
    enabled: !!user?.shiftsEnabled,
  });
  const shiftBlocked = !!user?.shiftsEnabled && !shiftQuery.isLoading && !shiftQuery.data;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [filter, setFilter] = useState<Filter>('owing');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState<{ order: RestaurantOrder; customer: CreditCustomer } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bookQuery = useQuery({
    queryKey: queryKeys.creditCustomers(debouncedSearch, filter),
    queryFn: () => restaurantApi.creditCustomers({ search: debouncedSearch, status: filter }),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant', 'credit'] });
  }, [queryClient]);

  const { connected } = useRealtime({ events: [RealtimeEvents.orderUpdated], onChange: refresh });

  const collect = async (body: SettleBody) => {
    if (!paying) return;
    setSubmitting(true);
    try {
      const paid = await restaurantApi.settleCredit(paying.order.id, body);
      // A store server older than this till drops the tip without a word. The
      // order is paid either way; only claim the tip when it was really stored.
      const dropped = tipWasDropped(body, paid);
      if (dropped) {
        toast.warning('Paid, but the tip was not recorded. This till’s server needs an update.');
      }
      toast.success(
        `${orderLabel(paying.order)} paid by ${paying.customer.name}` +
          (body.tipAmount && !dropped ? ` · tip ${format(body.tipAmount)} recorded` : ''),
      );
      setPaying(null);
      // The credit book, and this cashier's shift takings, both moved.
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to mark the order paid');
      // The owner may have just changed which tips are recorded: re-read the
      // switches so the box matches what the server will accept.
      if (body.tipAmount) void refreshProfile();
    } finally {
      setSubmitting(false);
    }
  };

  const book = bookQuery.data;
  const customers = book?.customers ?? [];

  return (
    <Screen scrollable refreshing={bookQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 12 }}>
        <ConnectionBanner connected={connected} />

        <Text variant="h2">Credit Sales</Text>
        <Text variant="caption" color="mutedForeground">
          Orders customers took on credit. Mark one paid when the customer pays — it counts in
          sales on that day, for whoever collects it.
        </Text>

        {/* Staff only: the owner has no drawer, and the bar hides itself when shifts are off. */}
        {staff ? <ShiftBar /> : null}

        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
            <Text variant="caption" color="mutedForeground">Outstanding</Text>
            <Text variant="bodySemibold" style={{ color: theme.colors.warning }}>
              {format(book?.totals.outstanding ?? 0)}
            </Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
            <Text variant="caption" color="mutedForeground">Customers owing</Text>
            <Text variant="bodySemibold">{book?.totals.customersOwing ?? 0}</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
            <Text variant="caption" color="mutedForeground">Unpaid orders</Text>
            <Text variant="bodySemibold">{book?.totals.unpaidCount ?? 0}</Text>
          </View>
        </View>

        <SearchInput value={search} onChangeText={setSearch} placeholder="Search customer name or phone" />
        <FilterPillRow options={FILTERS} value={filter} onChange={setFilter} scrollable={false} />

        {customers.length === 0 && !bookQuery.isLoading ? (
          <EmptyState
            icon={<NotebookPen size={28} color={theme.colors.mutedForeground} />}
            title={
              debouncedSearch
                ? 'No customer matches'
                : filter === 'owing'
                  ? 'Nobody owes anything'
                  : 'No credit sales yet'
            }
            description='Use "Add to credit sales" on the Cashier tab to put an order on a customer’s account.'
          />
        ) : (
          customers.map((customer) => {
            const isOpen = !!open[customer.customerId];
            const owing = customer.unpaidCount > 0;
            return (
              <View
                key={customer.customerId}
                style={[
                  styles.card,
                  {
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.card,
                    borderColor: owing ? tint(theme.colors.warning, 0.5) : theme.colors.border,
                  },
                ]}
              >
                <Pressable
                  onPress={() => setOpen((prev) => ({ ...prev, [customer.customerId]: !isOpen }))}
                  style={styles.row}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodySemibold" numberOfLines={1}>
                      {customer.name}
                    </Text>
                    {customer.phone ? (
                      <View style={styles.phone}>
                        <Phone size={12} color={theme.colors.mutedForeground} />
                        <Text variant="caption" color="mutedForeground">
                          {customer.phone}
                        </Text>
                      </View>
                    ) : null}
                    <Text variant="caption" color="mutedForeground">
                      {customer.unpaidCount} unpaid · {customer.paidCount} paid · last {when(customer.lastCreditedAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      variant="bodySemibold"
                      style={{ color: owing ? theme.colors.warning : theme.colors.success }}
                    >
                      {owing ? format(customer.outstanding) : 'Settled'}
                    </Text>
                    {owing ? (
                      <Text variant="caption" color="mutedForeground">
                        owed
                      </Text>
                    ) : null}
                  </View>
                  <ChevronDown
                    size={16}
                    color={theme.colors.mutedForeground}
                    style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                  />
                </Pressable>

                {isOpen ? (
                  <CustomerOrders
                    customer={customer}
                    canCollect={staff}
                    shiftBlocked={shiftBlocked}
                    onCollect={(order) => setPaying({ order, customer })}
                  />
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <CollectCreditSheet
        order={paying?.order ?? null}
        customerName={paying?.customer.name ?? ''}
        money={format}
        submitting={submitting}
        onClose={() => setPaying(null)}
        onConfirm={collect}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  order: { borderWidth: 1, padding: 12, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderWidth: 1, padding: 10, gap: 2 },
});
