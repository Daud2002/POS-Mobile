import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, Globe, HandCoins, Receipt, Wallet } from 'lucide-react-native';

import { shiftsApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/app/providers/AuthProvider';
import { Screen, SectionHeader } from '@/components/layout';
import { SectionCard, KeyValueRow, StatCard } from '@/components/data';
import { Text, EmptyState } from '@/components/ui';
import { TipsBreakdown } from '@/features/restaurant/components/TipsBreakdown';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { toNumber } from '@/lib/format';
import { takingsSummary } from '@/lib/payment';
import { hasTips, shiftFigures } from '@/lib/shiftMaths';
import { recordsAnyTips, tipCells, tipPolicyOf } from '@/lib/tips';
import { useTheme } from '@/theme';
import type { CashierShift } from '@/api/types';
import { ShiftBar } from '../components/ShiftBar';
import { ShiftDrawer, ShiftTakings } from '../components/ShiftMoney';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
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

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  closed: 'Awaiting collection',
  collected: 'Handed over',
};

/**
 * The cashier's own dashboard: what THEY collected.
 *
 * Deliberately not the owner's dashboard. No store revenue, no profit, no cost
 * prices and no other cashier's figures — only the money this person is
 * personally accountable for at the end of their shift.
 */
export function CashierDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<string>('today');

  const dashboardQuery = useQuery({
    queryKey: queryKeys.cashierDashboard(range),
    queryFn: () => shiftsApi.myDashboard(rangeStart(range)),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  // Their own figures move the moment they settle a bill.
  useRealtime({
    events: [
      RealtimeEvents.orderUpdated,
      RealtimeEvents.shiftClosed,
      RealtimeEvents.shiftCollected,
    ],
    onChange: refresh,
  });

  const data = dashboardQuery.data;
  const totals = data?.range;
  const current = data?.currentShift;

  /**
   * Tips this cashier took in the window. The card appears once the store
   * records tips at all, so a quiet day reads "0" rather than hiding the
   * figure — and stays if tips were taken before the owner switched them off.
   */
  const tipsTaken = toNumber(totals?.tips);
  const showTips = tipsTaken > 0 || recordsAnyTips(tipPolicyOf(user));
  const currentFigures = shiftFigures(current);

  const openShift = (shift: CashierShift) =>
    navigation.navigate('ShiftDetail', { shiftId: shift.id });

  return (
    <Screen scrollable refreshing={dashboardQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 14 }}>
        {/*
          Opening and closing the drawer lives here rather than on the till.
          It is a start-of-day / end-of-day action, and this is the screen the
          cashier is accountable on. Renders nothing when shifts are off.
        */}
        <ShiftBar />

        <View>
          <Text variant="h2">My collections</Text>
          <Text variant="caption" color="mutedForeground">
            Money you took, and what you owe at the end of your shift.
          </Text>
        </View>

        <View style={styles.pills}>
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              style={[
                styles.pill,
                {
                  borderColor: range === r.key ? theme.colors.primary : theme.colors.border,
                  backgroundColor:
                    range === r.key ? `${theme.colors.primary}1A` : 'transparent',
                },
              ]}
            >
              <Text variant="caption">{r.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          {/* Cash first: it is the only figure that becomes a physical
              handover at the end of the shift. */}
          <StatCard
            title="Cash collected"
            value={format(toNumber(totals?.cash))}
            icon={<Banknote size={18} color={theme.colors.primary} />}
          />
          <StatCard
            title="Card"
            value={format(toNumber(totals?.card))}
            icon={<CreditCard size={18} color={theme.colors.primary} />}
          />
          <StatCard
            title="Online"
            value={format(toNumber(totals?.online))}
            icon={<Globe size={18} color={theme.colors.primary} />}
          />
          <StatCard
            title="Orders settled"
            value={String(totals?.orderCount ?? 0)}
            icon={<Receipt size={18} color={theme.colors.primary} />}
          />
          {/* Beside the sales, never in them: every figure above is bills only. */}
          {showTips && (
            <StatCard
              title="Tips"
              value={format(tipsTaken)}
              subtitle="not counted in sales"
              icon={<HandCoins size={18} color={theme.colors.primary} />}
              footer={
                tipsTaken > 0 ? (
                  <TipsBreakdown
                    total={tipsTaken}
                    cells={tipCells(totals?.tipsBreakdown)}
                    money={format}
                    label="By order type"
                    hideTotal
                  />
                ) : undefined
              }
            />
          )}
        </View>

        {current && (
          <SectionCard
            title="Current shift"
            action={
              <Pressable onPress={() => openShift(current)}>
                <Text variant="caption" style={{ color: theme.colors.primary }}>
                  View orders
                </Text>
              </Pressable>
            }
          >
            <KeyValueRow
              label="Opened"
              value={current.openedAt ? new Date(current.openedAt).toLocaleString() : '—'}
            />
            {/*
              Everything taken, by method, then the drawer arithmetic. Card
              and online are shown even though they never enter the drawer —
              the cashier is accountable for the whole shift, and "In drawer
              now" only makes sense next to the figures it leaves out.
            */}
            {hasTips(currentFigures) ? (
              // With tips the rows become two small ledgers: what came in by
              // method (received, of which tips, leaving sales), and the
              // drawer down to the cash to hand over once the tips are out.
              <View style={styles.ledgers}>
                <View style={styles.ledger}>
                  <Text variant="overline" color="mutedForeground">
                    Takings this shift
                  </Text>
                  <ShiftTakings figures={currentFigures} money={format} totalLabel="Total" />
                </View>
                <View style={styles.ledger}>
                  <Text variant="overline" color="mutedForeground">
                    Cash drawer
                  </Text>
                  <ShiftDrawer figures={currentFigures} money={format} />
                </View>
              </View>
            ) : (
              <>
                <KeyValueRow label="Cash taken" value={format(toNumber(current.totals?.cashSales))} />
                <KeyValueRow label="Card" value={format(toNumber(current.totals?.cardSales))} />
                <KeyValueRow label="Online" value={format(toNumber(current.totals?.onlineSales))} />
                <KeyValueRow
                  label="Total taken"
                  value={format(toNumber(current.totals?.totalSales))}
                  emphasis
                />
                <KeyValueRow label="Opening float" value={format(toNumber(current.openingFloat))} />
                <KeyValueRow label="+ Cash taken" value={format(toNumber(current.totals?.cashSales))} />
                <KeyValueRow label="− Paid out" value={format(toNumber(current.totals?.cashPaidOut))} />
                <KeyValueRow
                  label="= In drawer now"
                  value={format(toNumber(current.totals?.expectedCash))}
                  emphasis
                />
              </>
            )}
          </SectionCard>
        )}

        <SectionHeader title="My recent shifts" />
        {!data?.recentShifts?.length ? (
          <EmptyState title="No shifts yet" description="Open a shift to start taking payments." />
        ) : (
          <View style={{ gap: 8 }}>
            {data.recentShifts.map((shift) => {
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
                  onPress={() => openShift(shift)}
                  style={[
                    styles.row,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySemibold" numberOfLines={1}>
                      {shift.openedAt ? new Date(shift.openedAt).toLocaleDateString() : '—'}
                    </Text>
                    <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                      {STATUS_LABEL[shift.status] ?? shift.status} ·{' '}
                      {format(toNumber(shift.totalSales))} · {shift.orderCount ?? 0} orders
                    </Text>
                    {/* By method, so a shift's card and online takings are
                        visible without opening it. Absent while still open. */}
                    {takingsSummary(shift, format) ? (
                      <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                        {takingsSummary(shift, format)}
                      </Text>
                    ) : null}
                  </View>
                  {diff !== null && diff !== undefined && (
                    <Text variant="smallMedium" style={{ color: diffColor }}>
                      {Number(diff) === 0
                        ? 'Balanced'
                        : `${Number(diff) > 0 ? 'Over' : 'Short'} ${format(Math.abs(Number(diff)))}`}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ledgers: { gap: 14, marginTop: 8 },
  ledger: { gap: 6 },
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
