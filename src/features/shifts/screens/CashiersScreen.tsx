import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Wallet } from 'lucide-react-native';

import { shiftsApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { KeyValueRow } from '@/components/data';
import { Text, EmptyState } from '@/components/ui';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme';

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

/**
 * The owner's view of what each cashier collected.
 *
 * One card per person rather than a table: on a phone the numbers that matter
 * are what they took, whether the drawer balanced, and how much is still to be
 * handed over — the rest is drill-down.
 */
export function CashiersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<string>('today');
  const from = rangeStart(range);

  const summaryQuery = useQuery({
    queryKey: queryKeys.cashierSummary(range),
    queryFn: () => shiftsApi.summaryByCashier(from),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  useRealtime({
    events: [
      RealtimeEvents.shiftOpened,
      RealtimeEvents.shiftClosed,
      RealtimeEvents.shiftCollected,
      RealtimeEvents.orderUpdated,
    ],
    onChange: refresh,
  });

  const rows = summaryQuery.data ?? [];
  const pending = rows.reduce((sum, r) => sum + toNumber(r.pendingCollection), 0);

  return (
    <Screen scrollable refreshing={summaryQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 14 }}>
        <View style={styles.pills}>
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              style={[
                styles.pill,
                {
                  borderColor: range === r.key ? theme.colors.primary : theme.colors.border,
                  backgroundColor: range === r.key ? `${theme.colors.primary}1A` : 'transparent',
                },
              ]}
            >
              <Text variant="caption">{r.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Counted and closed but not yet received — money the owner is owed
            right now, which is the reason to open this screen at all. */}
        {pending > 0 && (
          <View
            style={[
              styles.banner,
              { borderColor: theme.colors.warning, backgroundColor: `${theme.colors.warning}18` },
            ]}
          >
            <Wallet size={16} color={theme.colors.warning} />
            <Text variant="caption" style={{ color: theme.colors.warning, flex: 1 }}>
              {format(pending)} has been counted and closed but not yet marked as
              received from your cashiers.
            </Text>
          </View>
        )}

        {rows.length === 0 ? (
          <EmptyState
            title="No shifts in this period"
            description="Cashier takings appear here once someone opens a shift."
            icon={<Users size={28} color={theme.colors.mutedForeground} />}
          />
        ) : (
          rows.map((row) => {
            const diff = toNumber(row.difference);
            const diffColor =
              diff === 0
                ? theme.colors.mutedForeground
                : diff > 0
                  ? theme.colors.info
                  : theme.colors.destructive;
            return (
              <Pressable
                key={row.userId}
                onPress={() =>
                  navigation.navigate('Shifts', { userId: row.userId, name: row.name })
                }
                style={[
                  styles.card,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                ]}
              >
                <View style={styles.cardHead}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    {/* A live dot beats a status column when the answer is
                        usually "nobody is on right now". */}
                    {row.openNow && (
                      <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
                    )}
                    <Text variant="bodySemibold" numberOfLines={1}>
                      {row.name}
                    </Text>
                  </View>
                  <Text variant="bodySemibold">{format(toNumber(row.totalSales))}</Text>
                </View>

                <KeyValueRow label="Cash" value={format(toNumber(row.cashSales))} />
                <KeyValueRow label="Card" value={format(toNumber(row.cardSales))} />
                <KeyValueRow label="Online" value={format(toNumber(row.onlineSales))} />
                <KeyValueRow label="Expected in drawer" value={format(toNumber(row.expectedCash))} />
                <KeyValueRow label="Counted" value={format(toNumber(row.countedCash))} />

                <View style={styles.footRow}>
                  <Text variant="caption" style={{ color: diffColor }}>
                    {diff === 0
                      ? 'Balanced'
                      : `${diff > 0 ? 'Over' : 'Short'} ${format(Math.abs(diff))}`}
                  </Text>
                  <Text variant="caption" color="mutedForeground">
                    {row.shifts} shift{row.shifts === 1 ? '' : 's'} · {row.orders} orders
                  </Text>
                </View>

                {toNumber(row.pendingCollection) > 0 && (
                  <Text variant="smallMedium" style={{ color: theme.colors.warning }}>
                    {format(toNumber(row.pendingCollection))} to collect
                  </Text>
                )}
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
});
