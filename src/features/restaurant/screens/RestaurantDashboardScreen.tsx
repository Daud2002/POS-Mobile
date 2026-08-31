import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, DollarSign, Percent, ShoppingCart, TrendingUp, Wallet } from 'lucide-react-native';

import { expensesApi, restaurantApi } from '@/api/services';
import { useAuth } from '@/app/providers/AuthProvider';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { SectionCard, StatCard, StatRow, KeyValueRow } from '@/components/data';
import { Text } from '@/components/ui';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { can } from '@/lib/access';
import { localDateKey } from '@/lib/date';
import { tint, useTheme } from '@/theme';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All' },
] as const;

function rangeStart(key: string): string | undefined {
  const now = new Date();
  if (key === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (key === '7d') return new Date(now.getTime() - 7 * 864e5).toISOString();
  if (key === '30d') return new Date(now.getTime() - 30 * 864e5).toISOString();
  return undefined;
}

export function RestaurantDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<string>('today');

  const reportQuery = useQuery({
    queryKey: queryKeys.restaurantReport(range),
    queryFn: () => restaurantApi.salesReport(rangeStart(range)),
  });

  /**
   * Today's spend. Deliberately not tied to the range picker above — the owner
   * wants today's outgoings whichever sales window they are looking at.
   *
   * The day key comes from the DEVICE, so "today" is the user's calendar day
   * rather than the API server's timezone.
   */
  const today = localDateKey(new Date());
  const canSeeExpenses = can(user, 'expenses');
  const expensesQuery = useQuery({
    queryKey: queryKeys.expenseSummary(today),
    queryFn: () => expensesApi.summary(today),
    enabled: canSeeExpenses,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  // Revenue lands as the cashier settles.
  useRealtime({ events: [RealtimeEvents.orderUpdated], onChange: refresh });

  const report = reportQuery.data;
  const margin = report && report.revenue > 0 ? (report.profit / report.revenue) * 100 : 0;

  return (
    <Screen scrollable refreshing={reportQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 14 }}>
        <Text variant="h2">Dashboard</Text>

        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              style={[
                styles.rangeBtn,
                {
                  borderRadius: theme.radius.full,
                  borderColor: range === r.key ? theme.colors.primary : theme.colors.border,
                  backgroundColor:
                    range === r.key ? tint(theme.colors.primary, 0.1) : 'transparent',
                },
              ]}
            >
              <Text variant="caption">{r.label}</Text>
            </Pressable>
          ))}
        </View>

        <StatRow>
          <StatCard
            title="Revenue"
            value={format(report?.revenue ?? 0)}
            icon={<DollarSign size={18} color={theme.colors.primary} />}
          />
          <StatCard
            title="Profit"
            value={format(report?.profit ?? 0)}
            subtitle={`${margin.toFixed(1)}% margin`}
            icon={<TrendingUp size={18} color={theme.colors.success} />}
          />
          <StatCard
            title="Orders"
            value={String(report?.orderCount ?? 0)}
            icon={<ShoppingCart size={18} color={theme.colors.info} />}
          />
          <StatCard
            title="Discounts"
            value={format(report?.discountTotal ?? 0)}
            icon={<Percent size={18} color={theme.colors.warning} />}
          />
          {/* Behind the expenses module: staff given the dashboard but not
              expenses never see the store's outgoings. */}
          {canSeeExpenses ? (
            <StatCard
              title="Expenses today"
              value={format(expensesQuery.data?.today ?? 0)}
              subtitle={`${format(expensesQuery.data?.month ?? 0)} this month`}
              icon={<Wallet size={18} color={theme.colors.destructive} />}
              loading={expensesQuery.isLoading}
            />
          ) : null}
        </StatRow>

        {/*
          Profit is only as trustworthy as the cost prices behind it. Rather
          than present a confidently wrong number, say so explicitly.
        */}
        {!!report?.unknownCostLineCount && (
          <View
            style={[
              styles.warning,
              {
                borderRadius: theme.radius.md,
                backgroundColor: tint(theme.colors.warning, 0.1),
                borderColor: tint(theme.colors.warning, 0.4),
              },
            ]}
          >
            <AlertTriangle size={16} color={theme.colors.warning} />
            <Text variant="caption" style={{ color: theme.colors.warning, flex: 1 }}>
              {report.unknownCostLineCount} sold item
              {report.unknownCostLineCount === 1 ? '' : 's'} had no cost price, so profit is
              overstated. Set a cost on those dishes to correct it.
            </Text>
          </View>
        )}

        <SectionCard title="Top dishes">
          {report?.topProducts?.length ? (
            report.topProducts.map((p) => (
              <KeyValueRow
                key={p.name}
                label={`${p.quantity} × ${p.name}`}
                value={format(p.revenue)}
              />
            ))
          ) : (
            <Text variant="caption" color="mutedForeground">No settled orders yet.</Text>
          )}
        </SectionCard>

        {/*
          Two different questions, deliberately kept apart: who SOLD it (the
          waiter who opened the order) and who COLLECTED it (the cashier who
          took the money and has to hand it over).
        */}
        <SectionCard
          title="By cashier"
          action={
            <Pressable onPress={() => navigation.navigate('Cashiers')}>
              <Text variant="caption" style={{ color: theme.colors.primary }}>
                Shifts
              </Text>
            </Pressable>
          }
        >
          {report?.byCashier?.length ? (
            report.byCashier.map((c) => (
              <KeyValueRow key={c.name} label={`${c.name} · ${c.orders}`} value={format(c.revenue)} />
            ))
          ) : (
            <Text variant="caption" color="mutedForeground">No data yet.</Text>
          )}
        </SectionCard>

        <SectionCard title="By waiter">
          {report?.byWaiter?.length ? (
            report.byWaiter.map((w) => (
              <KeyValueRow key={w.name} label={`${w.name} · ${w.orders}`} value={format(w.revenue)} />
            ))
          ) : (
            <Text variant="caption" color="mutedForeground">No data yet.</Text>
          )}
        </SectionCard>

        <SectionCard title="By order type">
          {report?.byOrderType?.length ? (
            report.byOrderType.map((t) => (
              <KeyValueRow
                key={t.orderType}
                label={String(t.orderType).replace('_', '-')}
                value={`${t.orders} · ${format(t.revenue)}`}
              />
            ))
          ) : (
            <Text variant="caption" color="mutedForeground">No data yet.</Text>
          )}
        </SectionCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: 'row', gap: 8 },
  rangeBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  warning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderWidth: 1, padding: 12,
  },
});
