import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, LockKeyhole } from 'lucide-react-native';

import { shiftsApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Button, Input, Sheet, Text, useToast } from '@/components/ui';
import { useAuth } from '@/app/providers/AuthProvider';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme';
import type { CashierShift } from '@/api/types';
import { CloseShiftSheet } from './CloseShiftSheet';

/**
 * The cashier's till header: who is on the drawer and what is in it.
 *
 * Renders nothing at all for tenants that have not turned shifts on, so the
 * till behaves exactly as it did before the feature existed.
 */
export function ShiftBar({ onShiftChange }: { onShiftChange?: (shift: CashierShift | null) => void }) {
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const enabled = !!user?.shiftsEnabled;

  const [openSheet, setOpenSheet] = useState(false);
  const [closeSheet, setCloseSheet] = useState(false);
  const [floatText, setFloatText] = useState('');
  const [opening, setOpening] = useState(false);

  const shiftQuery = useQuery({
    queryKey: queryKeys.currentShift(),
    queryFn: () => shiftsApi.current(),
    enabled,
  });

  const shift = shiftQuery.data ?? null;

  // Kept in sync for the parent, which disables settling without a drawer.
  if (enabled && !shiftQuery.isLoading) onShiftChange?.(shift);

  if (!enabled) return null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  };

  const open = async () => {
    setOpening(true);
    try {
      await shiftsApi.open(toNumber(floatText));
      setOpenSheet(false);
      setFloatText('');
      toast.success('Shift opened');
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not open your shift');
    } finally {
      setOpening(false);
    }
  };

  if (!shift) {
    return (
      <>
        <View style={[styles.warn, { borderColor: theme.colors.warning, backgroundColor: `${theme.colors.warning}18` }]}>
          <LockKeyhole size={16} color={theme.colors.warning} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="caption" style={{ color: theme.colors.warning }}>
              Your shift is not open. Open it before taking payments — every bill
              you settle is counted against your drawer.
            </Text>
            <Button size="sm" label="Open shift" onPress={() => setOpenSheet(true)} />
          </View>
        </View>

        <Sheet
          open={openSheet}
          onClose={() => setOpenSheet(false)}
          title="Open your shift"
          description="Count the change already in your drawer. Everything you collect today is measured against this starting amount."
          footer={
            <Button label={opening ? 'Opening…' : 'Open shift'} loading={opening} onPress={open} />
          }
        >
          <Input
            label="Opening float"
            keyboardType="decimal-pad"
            value={floatText}
            onChangeText={setFloatText}
            placeholder="0"
          />
        </Sheet>
      </>
    );
  }

  const totals = shift.totals;

  return (
    <>
      <View style={[styles.bar, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <View style={[styles.icon, { backgroundColor: `${theme.colors.primary}1A` }]}>
          <Wallet size={16} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySemibold" numberOfLines={1}>
            Shift open since{' '}
            {shift.openedAt
              ? new Date(shift.openedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </Text>
          {/* Cash is called out separately: it is the only figure that has to
              match what is physically in the drawer. */}
          <Text variant="caption" color="mutedForeground" numberOfLines={1}>
            Cash {format(toNumber(totals?.cashSales))} · Total{' '}
            {format(toNumber(totals?.totalSales))} · {totals?.orderCount ?? 0} orders
          </Text>
        </View>
        <Button size="sm" variant="outline" label="Close" onPress={() => setCloseSheet(true)} />
      </View>

      <CloseShiftSheet
        open={closeSheet}
        onClose={() => setCloseSheet(false)}
        shift={shift}
        onClosed={refresh}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warn: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
