import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/queryKeys';
import { reportsApi } from '@/api/services';
import type { ProfitPeriodKey } from '@/api/types';
import { SectionCard } from '@/components/data/SectionCard';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Divider } from '@/components/ui/Divider';
import { Text } from '@/components/ui/Text';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { deviceTimeZone } from '@/lib/date';
import { tint, useTheme } from '@/theme';

const PERIODS: { key: ProfitPeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'last3Months', label: 'Past 3 months' },
  { key: 'last6Months', label: 'Past 6 months' },
  { key: 'thisYear', label: 'This year' },
  { key: 'allTime', label: 'All time' },
];

interface ProfitSectionProps {
  /**
   * Whether the viewer holds the expenses module. When they do not, the
   * server sends null for expenses and net, and those show a dash.
   */
  showExpenses: boolean;
}

/**
 * Gross and net profit over the standard windows, for either dashboard.
 *
 * Gross = what the goods sold for − what they cost (the cost snapshotted on
 * each line when it was sold). Net = gross − expenses booked in the window.
 * One row per window: the label, then gross and net side by side.
 */
export function ProfitSection({ showExpenses }: ProfitSectionProps) {
  const theme = useTheme();
  const { format } = useStoreCurrency();
  const tz = deviceTimeZone();

  const query = useQuery({
    queryKey: queryKeys.profitReport(tz),
    queryFn: () => reportsApi.profit(tz),
  });

  const report = query.data;
  const unknownCost = report?.periods.allTime.unknownCostLineCount ?? 0;

  const toneFor = (value: number | null | undefined) => {
    if (value === null || value === undefined) return theme.colors.mutedForeground;
    if (value < 0) return theme.colors.destructive;
    if (value > 0) return theme.colors.success;
    return theme.colors.foreground;
  };

  return (
    <SectionCard title="Profit" subtitle="Gross = sales − cost of goods · Net = gross − expenses">
      {query.isLoading ? (
        <SkeletonList count={6} lines={1} />
      ) : !report ? (
        <Text variant="caption" color="mutedForeground">
          Profit figures are not available right now.
        </Text>
      ) : (
        <View>
          <View style={[styles.row, { paddingBottom: theme.spacing.xs }]}>
            <Text variant="overline" color="mutedForeground" style={styles.label}>
              Period
            </Text>
            <Text variant="overline" color="mutedForeground" style={styles.cell}>
              Gross
            </Text>
            <Text variant="overline" color="mutedForeground" style={styles.cell}>
              Net
            </Text>
          </View>
          {PERIODS.map(({ key, label }, index) => {
            const row = report.periods[key];
            const net = showExpenses ? row.netProfit : null;
            return (
              <View key={key}>
                {index > 0 ? <Divider /> : null}
                <View style={[styles.row, { paddingVertical: theme.spacing.sm }]}>
                  <View style={styles.label}>
                    <Text variant="smallMedium">{label}</Text>
                    <Text variant="caption" color="mutedForeground">
                      {row.orderCount} order{row.orderCount === 1 ? '' : 's'} · {format(row.revenue)}
                    </Text>
                  </View>
                  <Text variant="money" style={[styles.cell, { color: toneFor(row.grossProfit) }]}>
                    {format(row.grossProfit)}
                  </Text>
                  <Text variant="money" style={[styles.cell, { color: toneFor(net) }]}>
                    {net === null || net === undefined ? '—' : format(net)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/*
        Profit is only as good as the cost prices behind it. Rather than show
        a confidently wrong number, say so when some lines had no cost.
      */}
      {!query.isLoading && unknownCost > 0 ? (
        <View
          style={[
            styles.warning,
            {
              marginTop: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: tint(theme.colors.warning, 0.1),
              borderColor: tint(theme.colors.warning, 0.4),
            },
          ]}
        >
          <AlertTriangle size={14} color={theme.colors.warning} />
          <Text variant="caption" style={{ color: theme.colors.warning, flex: 1 }}>
            {unknownCost} sold item{unknownCost === 1 ? '' : 's'} had no cost price, so profit is
            overstated. Set a cost on those products to correct it.
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1.4 },
  cell: { flex: 1, textAlign: 'right' },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    padding: 10,
  },
});
