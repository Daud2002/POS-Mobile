import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { shiftsApi } from '@/api/services';
import { Button, Input, Sheet, Text, useToast } from '@/components/ui';
import { KeyValueRow } from '@/components/data';
import { useAuth } from '@/app/providers/AuthProvider';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { toNumber } from '@/lib/format';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { useTheme } from '@/theme';
import type { CashierShift } from '@/api/types';

/**
 * Counting the drawer and handing over.
 *
 * Card and online takings are shown but excluded from the reconciliation: that
 * money never passed through the till, and mixing it in is exactly how a
 * cashier appears to be short by the day's card sales.
 */
export function CloseShiftSheet({
  open,
  onClose,
  shift,
  onClosed,
}: {
  open: boolean;
  onClose: () => void;
  shift: CashierShift;
  onClosed?: () => void;
}) {
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const { printShiftReport, hasPrinter } = usePrinter();

  const [countedText, setCountedText] = useState('');
  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);

  const totals = shift.totals;
  const expected = toNumber(totals?.expectedCash);

  // Blank means "not counted yet", which is different from counting zero.
  const counted = countedText.trim() === '' ? null : toNumber(countedText);
  const difference = useMemo(
    () => (counted === null ? null : Number((counted - expected).toFixed(2))),
    [counted, expected],
  );

  const submit = async () => {
    if (counted === null) {
      toast.error('Enter the cash you counted');
      return;
    }
    setClosing(true);
    try {
      const closed = await shiftsApi.close(shift.id, {
        countedCash: counted,
        notes: notes.trim() || undefined,
      });

      // Printed from the SERVER's figures, never the local preview — the slip
      // is the physical record of what was handed over.
      if (hasPrinter) {
        const result = await printShiftReport({
          storeName: user?.storeName,
          cashierName: closed.cashierName ?? user?.name,
          openedAt: closed.openedAt,
          closedAt: closed.closedAt,
          openingFloat: toNumber(closed.openingFloat),
          cashSales: toNumber(closed.totals?.cashSales),
          cardSales: toNumber(closed.totals?.cardSales),
          onlineSales: toNumber(closed.totals?.onlineSales),
          otherSales: toNumber(closed.totals?.otherSales),
          totalSales: toNumber(closed.totals?.totalSales),
          orderCount: closed.totals?.orderCount ?? 0,
          cashPaidOut: toNumber(closed.totals?.cashPaidOut),
          expectedCash: toNumber(closed.totals?.expectedCash),
          countedCash: closed.countedCash ?? null,
          difference: closed.difference ?? null,
          notes: closed.closingNotes ?? null,
        });
        if (!result.ok) toast.error(result.error ?? 'Shift report printing failed');
      }

      toast.success('Shift closed. Hand the cash to the owner.');
      setCountedText('');
      setNotes('');
      onClose();
      onClosed?.();
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not close your shift');
    } finally {
      setClosing(false);
    }
  };

  const diffColor =
    difference === null || difference === 0
      ? theme.colors.success
      : difference > 0
        ? theme.colors.info
        : theme.colors.destructive;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Close your shift"
      description="Count the cash in your drawer. Card and online payments are listed for your records but are not handed over."
      footer={
        <Button
          label={closing ? 'Closing…' : 'Close & print'}
          loading={closing}
          disabled={counted === null}
          onPress={submit}
        />
      }
    >
      <View style={{ gap: 14 }}>
        <View style={[styles.block, { borderColor: theme.colors.border }]}>
          <KeyValueRow label="Cash sales" value={format(toNumber(totals?.cashSales))} />
          <KeyValueRow label="Card" value={format(toNumber(totals?.cardSales))} />
          <KeyValueRow label="Online" value={format(toNumber(totals?.onlineSales))} />
          <KeyValueRow label="Total takings" value={format(toNumber(totals?.totalSales))} />
        </View>

        <View style={[styles.block, { borderColor: theme.colors.border }]}>
          <KeyValueRow label="Opening float" value={format(toNumber(shift.openingFloat))} />
          <KeyValueRow label="+ Cash sales" value={format(toNumber(totals?.cashSales))} />
          <KeyValueRow label="− Cash paid out" value={format(toNumber(totals?.cashPaidOut))} />
          <KeyValueRow label="Should be in drawer" value={format(expected)} />
        </View>

        <Input
          label="Cash you counted"
          keyboardType="decimal-pad"
          value={countedText}
          onChangeText={setCountedText}
          placeholder="0"
        />

        {difference !== null && (
          <View style={[styles.diff, { backgroundColor: `${diffColor}1A` }]}>
            <Text variant="bodySemibold" style={{ color: diffColor }}>
              {difference === 0 ? 'Balanced' : difference > 0 ? 'Over by' : 'Short by'}
            </Text>
            <Text variant="bodySemibold" style={{ color: diffColor }}>
              {format(Math.abs(difference))}
            </Text>
          </View>
        )}

        {difference !== null && difference !== 0 && (
          <Input
            label="Explain the difference"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. gave change from my own pocket"
            multiline
          />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 },
  diff: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
