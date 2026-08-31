import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { shiftsApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { Text, EmptyState } from '@/components/ui';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'To collect' },
  { key: 'collected', label: 'Collected' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  closed: 'To collect',
  collected: 'Collected',
};

/**
 * Every shift for the store, optionally narrowed to one cashier when pushed
 * from the Cashiers screen.
 */
export function ShiftsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const userId: string | undefined = route.params?.userId;
  const cashierName: string | undefined = route.params?.name;

  const [status, setStatus] = useState<string>('');

  const shiftsQuery = useQuery({
    queryKey: queryKeys.shifts(`${userId ?? 'all'}:${status || 'any'}`),
    queryFn: () => shiftsApi.list({ userId, status: status || undefined }),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  useRealtime({
    events: [
      RealtimeEvents.shiftOpened,
      RealtimeEvents.shiftClosed,
      RealtimeEvents.shiftCollected,
    ],
    onChange: refresh,
  });

  const shifts = shiftsQuery.data ?? [];

  return (
    <Screen scrollable refreshing={shiftsQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 12 }}>
        {cashierName && (
          <Text variant="caption" color="mutedForeground">
            Showing {cashierName}
          </Text>
        )}

        <View style={styles.pills}>
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setStatus(f.key)}
              style={[
                styles.pill,
                {
                  borderColor: status === f.key ? theme.colors.primary : theme.colors.border,
                  backgroundColor: status === f.key ? `${theme.colors.primary}1A` : 'transparent',
                },
              ]}
            >
              <Text variant="caption">{f.label}</Text>
            </Pressable>
          ))}
        </View>

        {shifts.length === 0 ? (
          <EmptyState title="No shifts" description="Nothing matches this filter." />
        ) : (
          shifts.map((shift) => {
            const diff = shift.difference;
            const diffColor =
              diff === null || diff === undefined
                ? theme.colors.mutedForeground
                : Number(diff) === 0
                  ? theme.colors.success
                  : Number(diff) > 0
                    ? theme.colors.info
                    : theme.colors.destructive;
            return (
              <Pressable
                key={shift.id}
                onPress={() => navigation.navigate('ShiftDetail', { shiftId: shift.id })}
                style={[
                  styles.row,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodySemibold" numberOfLines={1}>
                    {shift.cashierName ?? 'Unknown'}
                    {'  '}
                    <Text
                      variant="caption"
                      style={{
                        color:
                          shift.status === 'open'
                            ? theme.colors.success
                            : shift.status === 'closed'
                              ? theme.colors.warning
                              : theme.colors.mutedForeground,
                      }}
                    >
                      {STATUS_LABEL[shift.status] ?? shift.status}
                    </Text>
                  </Text>
                  <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                    {shift.openedAt ? new Date(shift.openedAt).toLocaleString() : '—'} ·{' '}
                    {shift.orderCount ?? 0} orders
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodySemibold">{format(toNumber(shift.totalSales))}</Text>
                  {diff !== null && diff !== undefined && (
                    <Text variant="caption" style={{ color: diffColor }}>
                      {Number(diff) === 0
                        ? 'Balanced'
                        : `${Number(diff) > 0 ? 'Over' : 'Short'} ${format(Math.abs(Number(diff)))}`}
                    </Text>
                  )}
                </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
