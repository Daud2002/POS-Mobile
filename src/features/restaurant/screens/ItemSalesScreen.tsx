import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { categoriesApi, reportsApi } from '@/api/services';
import type { ItemSalesGrouping, ItemSalesRow } from '@/api/types';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { KeyValueRow, SectionCard } from '@/components/data';
import { Text } from '@/components/ui';
import { FilterPillRow } from '@/components/ui/FilterPill';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useStoreId } from '@/hooks/useStoreId';
import { deviceTimeZone } from '@/lib/date';
import { SALES_RANGES, salesRangeBounds, type SalesRangeKey } from '@/lib/periods';
import { sortBySortOrder } from '@/lib/sortOrder';
import { useTheme } from '@/theme';

const GROUPINGS: { value: ItemSalesGrouping; label: string }[] = [
  { value: 'none', label: 'By item' },
  { value: 'day', label: 'Per day' },
  { value: 'month', label: 'Per month' },
];

/** The "all categories" pill; real pills carry the category NAME the lines were sold under. */
const ALL = '__all';

/** Rows sharing a day or month, in the order the server sent them (newest first). */
function byPeriod(rows: ItemSalesRow[]): { period: string; rows: ItemSalesRow[] }[] {
  const groups: { period: string; rows: ItemSalesRow[] }[] = [];
  for (const row of rows) {
    const period = row.period ?? '';
    const last = groups[groups.length - 1];
    if (last && last.period === period) last.rows.push(row);
    else groups.push({ period, rows: [row] });
  }
  return groups;
}

/**
 * What each menu item sold — over a window, or split per day or month.
 *
 * The owner's (and a supervisor's, with the dashboard) answer to "how many
 * Zingers did we sell yesterday". Windows are the device's local days, like
 * the dashboard, and the server buckets days in the same zone.
 */
export function ItemSalesScreen() {
  const theme = useTheme();
  const storeId = useStoreId();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<SalesRangeKey>('today');
  const [groupBy, setGroupBy] = useState<ItemSalesGrouping>('none');
  const [category, setCategory] = useState(ALL);

  const tz = deviceTimeZone();
  const params = useMemo(
    () => ({
      ...salesRangeBounds(range),
      tz,
      groupBy,
      category: category === ALL ? undefined : category,
    }),
    [range, tz, groupBy, category],
  );

  const salesQuery = useQuery({
    queryKey: queryKeys.itemSales(`${range}|${groupBy}|${category}|${tz}`),
    queryFn: () => reportsApi.itemSales(params),
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(storeId ?? ''),
    queryFn: () => categoriesApi.list(storeId as string),
    enabled: !!storeId,
  });

  const categoryOptions = useMemo(
    () => [
      { value: ALL, label: 'All' },
      ...sortBySortOrder((categoriesQuery.data ?? []).filter((c) => c.isActive !== false)).map((c) => ({
        value: c.name,
        label: c.name,
      })),
    ],
    [categoriesQuery.data],
  );

  const report = salesQuery.data;
  const groups = useMemo(() => (report ? byPeriod(report.rows) : []), [report]);

  const rowLabel = (row: ItemSalesRow) =>
    category === ALL && row.category ? `${row.name} · ${row.category}` : row.name;

  return (
    <Screen
      scrollable
      refreshing={salesQuery.isRefetching}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['reports', 'item-sales'] })}
    >
      <View style={{ gap: 14 }}>
        <Text variant="h2">Item sales</Text>

        <FilterPillRow options={SALES_RANGES} value={range} onChange={setRange} />
        <FilterPillRow options={GROUPINGS} value={groupBy} onChange={setGroupBy} />
        {categoryOptions.length > 1 ? (
          <FilterPillRow options={categoryOptions} value={category} onChange={setCategory} />
        ) : null}

        {salesQuery.isLoading ? (
          <SkeletonList count={4} lines={1} />
        ) : !report?.rows.length ? (
          <SectionCard title="Nothing sold">
            <Text variant="caption" color="mutedForeground">
              No settled orders in this period.
            </Text>
          </SectionCard>
        ) : (
          groups.map((group) => (
            <SectionCard
              key={group.period || 'all'}
              title={group.period || 'Items'}
              subtitle={`${group.rows.reduce((sum, r) => sum + r.quantity, 0)} sold · ${format(
                group.rows.reduce((sum, r) => sum + r.revenue, 0),
              )}`}
            >
              {group.rows.map((row) => (
                <KeyValueRow
                  key={`${group.period}-${row.productId}`}
                  label={`${row.quantity} × ${rowLabel(row)}`}
                  value={format(row.revenue)}
                />
              ))}
            </SectionCard>
          ))
        )}

        {report?.rows.length ? (
          <SectionCard title="Total">
            <KeyValueRow label="Items sold" value={String(report.totals.quantity)} />
            <KeyValueRow label="Sales" value={format(report.totals.revenue)} />
          </SectionCard>
        ) : null}

        <Text variant="caption" color="mutedForeground" style={{ marginBottom: theme.spacing.lg }}>
          Sales are before order discounts, and count settled orders only.
        </Text>
      </View>
    </Screen>
  );
}
