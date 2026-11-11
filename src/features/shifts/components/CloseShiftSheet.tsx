import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { shiftsApi } from '@/api/services';
import { Button, Input, Sheet, Text, useToast } from '@/components/ui';
import { useAuth } from '@/app/providers/AuthProvider';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { toNumber } from '@/lib/format';
import { hasTips, shiftFigures, tipsOutOfDrawer } from '@/lib/shiftMaths';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { tint, useTheme } from '@/theme';
import type { CashierShift } from '@/api/types';
import { ShiftDrawer, ShiftTakings } from './ShiftMoney';

/**
 * Counting the drawer and handing over.
 *
 * Card and online takings are shown but excluded from the reconciliation: that
 * money never passed through the till, and mixing it in is exactly how a
 * cashier appears to be short by the day's card sales.
 *
 * TIPS come out before the count. Cash tips are in the drawer but are not the
 * owner's, and where the store pays card/online tips from cash those leave it
 * too — so what the cashier counts, and hands over, is what is left. The
 * figures are the server's; lib/shiftMaths only lays them out.
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

  const figures = shiftFigures(shift);
  const expected = figures.expectedCash;
  const tipped = hasTips(figures);
  const tipsOut = tipsOutOfDrawer(figures);

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
          // Sales, tips and the drawer arithmetic, exactly as stored.
          ...shiftFigures(closed),
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
      description={
        tipped
          ? 'Take the tips out of your drawer, then count what is left and enter it. Card and online payments are listed for your records but are not handed over.'
          : 'Count the cash in your drawer. Card and online payments are listed for your records but are not handed over.'
      }
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
          <ShiftTakings figures={figures} money={format} />
        </View>

        <View style={[styles.block, { borderColor: theme.colors.border }]}>
          <ShiftDrawer figures={figures} money={format} />
        </View>

        {tipsOut > 0 && (
          <View style={[styles.note, { backgroundColor: tint(theme.colors.warning, 0.12) }]}>
            <Text variant="caption">
              Take{' '}
              <Text variant="caption" style={{ fontFamily: theme.fontFamily.bodyBold }}>
                {format(tipsOut)}
              </Text>{' '}
              of tips out of the drawer before you count. They are for the staff and are not
              handed over.
            </Text>
          </View>
        )}

        <Input
          label={tipped ? 'Cash you counted, tips taken out' : 'Cash you counted'}
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
  note: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  diff: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
