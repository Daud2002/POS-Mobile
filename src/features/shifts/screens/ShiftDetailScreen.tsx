import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, LockKeyhole } from 'lucide-react-native';

import { shiftsApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { SectionCard, KeyValueRow } from '@/components/data';
import { Button, Input, Sheet, Text, EmptyState, useToast } from '@/components/ui';
import { useAuth } from '@/app/providers/AuthProvider';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { isOwner } from '@/lib/access';
import { orderDestination, orderLabel } from '@/lib/orderLabel';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  closed: 'Awaiting collection',
  collected: 'Collected',
};

/** One shift: its figures, and every order settled during it. */
export function ShiftDetailScreen() {
  const theme = useTheme();
  const toast = useToast();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const shiftId: string = route.params?.shiftId;
  const owner = isOwner(user);

  const [collectOpen, setCollectOpen] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const shiftQuery = useQuery({
    queryKey: queryKeys.shift(shiftId),
    queryFn: () => shiftsApi.get(shiftId),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  const shift = shiftQuery.data;
  const totals = shift?.totals;

  const collect = async () => {
    setBusy(true);
    try {
      await shiftsApi.collect(shiftId, {
        collectedAmount: toNumber(amountText),
        notes: notes.trim() || undefined,
      });
      toast.success('Marked as received');
      setCollectOpen(false);
      setNotes('');
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not record the collection');
    } finally {
      setBusy(false);
    }
  };

  const forceClose = async () => {
    setBusy(true);
    try {
      await shiftsApi.forceClose(shiftId, 'Closed by owner');
      toast.success('Shift closed');
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not close this shift');
    } finally {
      setBusy(false);
    }
  };

  if (!shift) {
    return (
      <Screen scrollable>
        <EmptyState title={shiftQuery.isLoading ? 'Loading…' : 'Shift not found'} />
      </Screen>
    );
  }

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
    <Screen scrollable refreshing={shiftQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 14 }}>
        <View>
          <Text variant="h2">{shift.cashierName ?? 'Shift'}</Text>
          <Text variant="caption" color="mutedForeground">
            {STATUS_LABEL[shift.status] ?? shift.status} ·{' '}
            {shift.openedAt ? new Date(shift.openedAt).toLocaleString() : '—'}
          </Text>
        </View>

        <SectionCard title="Takings">
          <KeyValueRow label="Cash" value={format(toNumber(totals?.cashSales))} />
          <KeyValueRow label="Card" value={format(toNumber(totals?.cardSales))} />
          <KeyValueRow label="Online" value={format(toNumber(totals?.onlineSales))} />
          <KeyValueRow label="Total" value={format(toNumber(totals?.totalSales))} emphasis />
          <KeyValueRow label="Orders" value={String(totals?.orderCount ?? 0)} />
        </SectionCard>

        {/* Only cash touches the drawer, which is why the reconciliation is
            separated from the takings above. */}
        <SectionCard title="Cash drawer">
          <KeyValueRow label="Opening float" value={format(toNumber(shift.openingFloat))} />
          <KeyValueRow label="Paid out" value={format(toNumber(totals?.cashPaidOut))} />
          <KeyValueRow label="Expected" value={format(toNumber(totals?.expectedCash))} emphasis />
          <KeyValueRow
            label="Counted"
            value={
              shift.countedCash === null || shift.countedCash === undefined
                ? 'Not counted'
                : format(toNumber(shift.countedCash))
            }
          />
          {diff !== null && diff !== undefined && (
            <View style={styles.diffRow}>
              <Text variant="smallMedium" style={{ color: diffColor }}>
                {Number(diff) === 0 ? 'Balanced' : Number(diff) > 0 ? 'Over' : 'Short'}
              </Text>
              <Text variant="smallMedium" style={{ color: diffColor }}>
                {format(Math.abs(Number(diff)))}
              </Text>
            </View>
          )}
          {shift.closingNotes ? (
            <Text variant="caption" color="mutedForeground">
              Cashier’s note: {shift.closingNotes}
            </Text>
          ) : null}
          {shift.status === 'collected' ? (
            <Text variant="caption" color="mutedForeground">
              Collected {format(toNumber(shift.collectedAmount))} by{' '}
              {shift.collectedByName ?? 'owner'}
            </Text>
          ) : null}
        </SectionCard>

        <SectionCard title={`Orders settled (${shift.orders?.length ?? 0})`}>
          {!shift.orders?.length ? (
            <Text variant="caption" color="mutedForeground">
              No orders were settled in this shift.
            </Text>
          ) : (
            shift.orders.map((order) => (
              <View key={order.id} style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" numberOfLines={1}>
                    {orderLabel(order)} · {orderDestination(order)}
                  </Text>
                  <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                    {order.settledAt
                      ? new Date(order.settledAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                    {order.paymentMethod ? ` · ${order.paymentMethod}` : ''}
                  </Text>
                </View>
                <Text variant="smallMedium">{format(toNumber(order.total))}</Text>
              </View>
            ))
          )}
        </SectionCard>

        {owner && shift.status === 'open' && (
          <Button
            variant="outline"
            label="Force close"
            loading={busy}
            onPress={forceClose}
            icon={<LockKeyhole size={16} color={theme.colors.foreground} />}
          />
        )}
        {owner && shift.status === 'closed' && (
          <Button
            label="Confirm received"
            onPress={() => {
              // Pre-filled with what the cashier counted — the owner usually
              // confirms that figure, and retyping it is friction.
              setAmountText(
                shift.countedCash === null || shift.countedCash === undefined
                  ? ''
                  : String(shift.countedCash),
              );
              setCollectOpen(true);
            }}
            icon={<HandCoins size={16} color={theme.colors.primaryForeground} />}
          />
        )}
      </View>

      <Sheet
        open={collectOpen}
        onClose={() => setCollectOpen(false)}
        title="Confirm cash received"
        description="Recorded separately from what the cashier counted — the gap between the two is worth seeing."
        footer={<Button label={busy ? 'Saving…' : 'Confirm'} loading={busy} onPress={collect} />}
      >
        <View style={{ gap: 12 }}>
          <Input
            label="Amount you received"
            keyboardType="decimal-pad"
            value={amountText}
            onChangeText={setAmountText}
          />
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            multiline
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  diffRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
});
