import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/queryKeys';
import { reportsApi } from '@/api/services';
import type { ProfitPeriodKey } from '@/api/types';
import { SectionCard } from '@/components/data/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { deviceTimeZone } from '@/lib/date';
import { PROFIT_PERIODS } from '@/lib/periods';
import { tint, useTheme } from '@/theme';

interface ProfitSectionProps {
  /**
   * Whether the viewer holds the expenses module. When they do not, the
   * server sends null for expenses and net, and those two cards are left out
   * altogether — the section never reveals the ledger by arithmetic.
   */
  showExpenses: boolean;
}

type Tone = 'positive' | 'negative' | 'neutral';

/** One figure. `tone` colours a profit red or green; plain figures stay neutral. */
function FigureCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  const theme = useTheme();
  const color =
    tone === 'positive'
      ? theme.colors.success
      : tone === 'negative'
        ? theme.colors.destructive
        : theme.colors.foreground;

  return (
    <View
      style={[
        styles.figure,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          backgroundColor: tint(theme.colors.muted, 0.4),
        },
      ]}
    >
      <Text variant="caption" color="mutedForeground">
        {label}
      </Text>
      <Text variant="money" style={{ color, marginTop: 4 }} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color="mutedForeground" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function FigureSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.figure,
        { borderColor: theme.colors.border, borderRadius: theme.radius.md, gap: 6 },
      ]}
    >
      <Skeleton width="50%" height={10} />
      <Skeleton width="80%" height={20} />
      <Skeleton width="40%" height={10} />
    </View>
  );
}

/**
 * Gross and net profit for ONE window at a time, as cards, for either
 * dashboard.
 *
 * Gross = what the goods sold for − what they cost (the cost snapshotted on
 * each line when it was sold). Net = gross − expenses booked in the window.
 * The window is picked from the pills under the title; all six arrive in one
 * request, so switching is instant and refetches nothing.
 *
 * Replaces a six-row table that showed every window at once — nobody reads
 * six periods side by side; they want one period's figures, large, and a way
 * to flick between them.
 */
export function ProfitSection({ showExpenses }: ProfitSectionProps) {
  const theme = useTheme();
  const { format } = useStoreCurrency();
  const tz = deviceTimeZone();
  const [period, setPeriod] = useState<ProfitPeriodKey>('today');

  const query = useQuery({
    queryKey: queryKeys.profitReport(tz),
    queryFn: () => reportsApi.profit(tz),
  });

  const report = query.data;
  const row = report?.periods[period];
  const unknownCost = row?.unknownCostLineCount ?? 0;

  const toneOf = (value: number | null | undefined): Tone => {
    if (value === null || value === undefined || value === 0) return 'neutral';
    return value < 0 ? 'negative' : 'positive';
  };

  /** Gross margin as a share of sales, when there were any. */
  const margin =
    row && row.revenue > 0
      ? `${((row.grossProfit / row.revenue) * 100).toFixed(1)}% margin`
      : undefined;

  return (
    <SectionCard title="Profit" subtitle="Gross = sales − cost of goods · Net = gross − expenses">
      {/*
        The period filter. Horizontal scroll rather than wrapping: six pills
        do not fit a phone's width, and a second row would push the figures
        below the fold. Anything added later (a cashier, an order type) joins
        this row.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.pills, { paddingBottom: theme.spacing.md }]}
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

      {query.isLoading ? (
        <View style={styles.grid}>
          {Array.from({ length: showExpenses ? 5 : 3 }, (_, i) => (
            <FigureSkeleton key={i} />
          ))}
        </View>
      ) : !row ? (
        /*
          The request failed, so there are no figures to show — say so rather
          than painting a row of zeros that reads as "no sales".
        */
        <Text variant="caption" color="mutedForeground">
          Profit figures are not available right now.
        </Text>
      ) : (
        <View style={styles.grid}>
          <FigureCard
            label="Sales"
            value={format(row.revenue)}
            hint={`${row.orderCount} order${row.orderCount === 1 ? '' : 's'}`}
          />
          <FigureCard label="Cost of goods" value={format(row.cost)} />
          <FigureCard
            label="Gross profit"
            value={format(row.grossProfit)}
            hint={margin}
            tone={toneOf(row.grossProfit)}
          />
          {showExpenses ? (
            <>
              <FigureCard label="Expenses" value={format(row.expenses ?? 0)} />
              <FigureCard
                label="Net profit"
                value={row.netProfit === null ? '—' : format(row.netProfit)}
                hint="after expenses"
                tone={toneOf(row.netProfit)}
              />
            </>
          ) : null}
        </View>
      )}

      {/*
        Profit is only as good as the cost prices behind it. Rather than show
        a confidently wrong number, say so when some lines in THIS window had
        no cost.
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
            {unknownCost} sold item{unknownCost === 1 ? '' : 's'} in this period had no cost price,
            so profit is overstated. Set a cost on those products to correct it.
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /** Two per row on a phone; `flexBasis` lets a third squeeze in on a tablet. */
  figure: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, padding: 12 },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    padding: 10,
  },
});
