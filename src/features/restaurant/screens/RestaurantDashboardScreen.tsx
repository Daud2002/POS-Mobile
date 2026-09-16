import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  DollarSign,
  Package,
  Percent,
  PiggyBank,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';

import { reportsApi, restaurantApi } from '@/api/services';
import type { ProfitPeriodKey } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { SectionCard, StatCard, StatRow, KeyValueRow } from '@/components/data';
import { Text } from '@/components/ui';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { can, canSeeShifts } from '@/lib/access';
import { deviceTimeZone } from '@/lib/date';
import { PROFIT_PERIODS, periodStart } from '@/lib/periods';
import { tint, useTheme } from '@/theme';

type Tone = 'positive' | 'negative' | 'neutral';

/** A profit reads green, a loss red; nothing at all stays neutral. */
function toneOf(value: number | null | undefined): Tone {
  if (value === null || value === undefined || value === 0) return 'neutral';
  return value < 0 ? 'negative' : 'positive';
}

export function RestaurantDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<ProfitPeriodKey>('today');

  /**
   * One period picker drives every figure at the top. Sales, cost, gross
   * profit, orders and discounts come from the sales report, windowed from
   * `periodStart`; expenses and net profit come from the profit report, which
   * computes the same six windows server-side in the device's zone. Both
   * apply the same "money taken" rule, so the two never disagree.
   */
  const reportQuery = useQuery({
    queryKey: queryKeys.restaurantReport(period),
    queryFn: () => restaurantApi.salesReport(periodStart(period)),
  });

  const canSeeExpenses = can(user, 'expenses');
  const tz = deviceTimeZone();
  const profitQuery = useQuery({
    queryKey: queryKeys.profitReport(tz),
    queryFn: () => reportsApi.profit(tz),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  }, [queryClient]);

  // Drawers are the `shifts` module: owners always, a supervisor when granted.
  const showShifts = canSeeShifts(user);

  // Revenue lands as the cashier settles.
  useRealtime({ events: [RealtimeEvents.orderUpdated], onChange: refresh });

  const report = reportQuery.data;
  const spend = profitQuery.data?.periods[period];
  const margin = report && report.revenue > 0 ? (report.profit / report.revenue) * 100 : 0;

  return (
    <Screen scrollable refreshing={reportQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 14 }}>
        <Text variant="h2">Dashboard</Text>

        {/*
          The period filter. Horizontal scroll rather than wrapping: six pills
          do not fit a phone's width, and a second row would push the figures
          below the fold.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        >
          {PROFIT_PERIODS.map(({ key, label }) => {
            const active = period === key;
            return (
              <Pressable
                key={key}
                onPress={() => setPeriod(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                  styles.pill,
                  {
                    borderRadius: theme.radius.full,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: active ? tint(theme.colors.primary, 0.1) : 'transparent',
                  },
                ]}
              >
                <Text variant={active ? 'smallMedium' : 'small'}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/*
          The whole picture for one window, swiped left to right like a P&L:
          revenue − cost of goods = gross profit; gross − expenses = net.
          Orders and discounts follow as context. Expenses and net sit behind
          the expenses module, so staff given the dashboard but not expenses
          never see the store's outgoings — nor net, which would reveal them
          by arithmetic.
        */}
        <StatRow>
          <StatCard
            title="Revenue"
            value={format(report?.revenue ?? 0)}
            icon={<DollarSign size={18} color={theme.colors.primary} />}
            loading={reportQuery.isLoading}
          />
          <StatCard
            title="Cost of goods"
            value={format(report?.cost ?? 0)}
            icon={<Package size={18} color={theme.colors.info} />}
            tone="info"
            loading={reportQuery.isLoading}
          />
          <StatCard
            title="Gross profit"
            value={format(report?.profit ?? 0)}
            subtitle={`${margin.toFixed(1)}% margin`}
            valueTone={toneOf(report?.profit)}
            icon={<TrendingUp size={18} color={theme.colors.success} />}
            loading={reportQuery.isLoading}
          />
          {canSeeExpenses ? (
            <StatCard
              title="Expenses"
              value={spend ? format(spend.expenses ?? 0) : '—'}
              icon={<Wallet size={18} color={theme.colors.destructive} />}
              tone="destructive"
              loading={profitQuery.isLoading}
            />
          ) : null}
          {canSeeExpenses ? (
            <StatCard
              title="Net profit"
              subtitle="after expenses"
              value={spend?.netProfit === null || spend?.netProfit === undefined ? '—' : format(spend.netProfit)}
              valueTone={toneOf(spend?.netProfit)}
              icon={<PiggyBank size={18} color={theme.colors.success} />}
              loading={profitQuery.isLoading}
            />
          ) : null}
          <StatCard
            title="Orders"
            value={String(report?.orderCount ?? 0)}
            icon={<ShoppingCart size={18} color={theme.colors.info} />}
            tone="info"
            loading={reportQuery.isLoading}
          />
          <StatCard
            title="Discounts"
            value={format(report?.discountTotal ?? 0)}
            icon={<Percent size={18} color={theme.colors.warning} />}
            tone="warning"
            loading={reportQuery.isLoading}
          />
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
            showShifts ? (
              <Pressable onPress={() => navigation.navigate('Cashiers')}>
                <Text variant="caption" style={{ color: theme.colors.primary }}>
                  Shifts
                </Text>
              </Pressable>
            ) : null
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
  pills: { flexDirection: 'row', gap: 8 },
  pill: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  warning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderWidth: 1, padding: 12,
  },
});
