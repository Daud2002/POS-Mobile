import { useQuery } from '@tanstack/react-query';
import { BarChart3, DollarSign, Receipt } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { queryKeys } from '@/api/queryKeys';
import { ordersApi } from '@/api/services';
import { Order, PaymentMethod } from '@/api/types';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { SectionCard } from '@/components/data/SectionCard';
import { StatCard } from '@/components/data/StatCard';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Text } from '@/components/ui/Text';
import { paymentLabel } from '@/constants/statuses';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { lastNDays, localDateKey, weekdayLabel } from '@/lib/date';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Revenue reporting.
 *
 * Rebuilt against the statuses the POS actually writes. The web Reports page
 * filters on `status === 'completed'`, which the app never sets — orders are
 * `paid` or `unpaid` — so it always shows zeros. It is also unreachable there:
 * its sidebar link is commented out.
 */
export function ReportsScreen() {
  const theme = useTheme();
  const { format } = useStoreCurrency();

  const query = useQuery({
    queryKey: queryKeys.orders(),
    queryFn: () => ordersApi.list(0, 1000),
  });

  const report = useMemo(() => {
    const orders = query.data ?? [];
    const revenueOrders = orders.filter(
      (order: Order) => order.status === 'paid' || order.status === 'completed',
    );

    const totalRevenue = revenueOrders.reduce(
      (sum, order) => sum + toNumber(order.total),
      0,
    );

    const averageOrderValue =
      revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0;

    // Local date keys, so evening sales are not pushed into the next UTC day.
    const revenueByDay = new Map<string, number>();
    for (const order of revenueOrders) {
      const key = localDateKey(order.createdAt);
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + toNumber(order.total));
    }

    const dailyRevenue = lastNDays(7).map((day) => ({
      label: weekdayLabel(day),
      value: revenueByDay.get(localDateKey(day)) ?? 0,
    }));

    const byMethod = new Map<PaymentMethod | 'unpaid', number>();
    for (const order of orders) {
      const key = order.paymentMethod ?? 'unpaid';
      byMethod.set(key, (byMethod.get(key) ?? 0) + 1);
    }

    // Same series order as the web charts: primary → accent → warning → info.
    const palette = [
      theme.colors.primary,
      theme.colors.accent,
      theme.colors.warning,
      theme.colors.info,
      theme.colors.destructive,
    ];

    const paymentMix = [...byMethod.entries()].map(([method, count], index) => ({
      label: method === 'unpaid' ? 'Unpaid' : paymentLabel(method as PaymentMethod),
      value: count,
      color: palette[index % palette.length],
    }));

    return {
      totalRevenue,
      orderCount: revenueOrders.length,
      averageOrderValue,
      dailyRevenue,
      paymentMix,
      hasData: orders.length > 0,
    };
  }, [query.data, theme.colors]);

  return (
    <Screen scrollable onRefresh={query.refetch} refreshing={query.isRefetching}>
      <SectionHeader title="Reports" subtitle="Revenue and payment breakdown" />

      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard
            title="Total Revenue"
            value={format(report.totalRevenue)}
            icon={<DollarSign size={18} color={theme.colors.primary} />}
            loading={query.isLoading}
          />
          <StatCard
            title="Paid Orders"
            value={String(report.orderCount)}
            icon={<Receipt size={18} color={theme.colors.primary} />}
            loading={query.isLoading}
          />
        </View>

        <StatCard
          title="Average Order Value"
          value={format(report.averageOrderValue)}
          icon={<BarChart3 size={18} color={theme.colors.primary} />}
          loading={query.isLoading}
        />
      </View>

      <SectionCard title="Daily Revenue" subtitle="Last 7 days">
        <BarChart data={report.dailyRevenue} formatValue={format} />
      </SectionCard>

      <SectionCard title="Payment Methods" subtitle="Share of all orders">
        {report.paymentMix.length === 0 ? (
          <Text variant="small" color="mutedForeground">
            No orders recorded yet.
          </Text>
        ) : (
          <DonutChart data={report.paymentMix} />
        )}
      </SectionCard>
    </Screen>
  );
}
