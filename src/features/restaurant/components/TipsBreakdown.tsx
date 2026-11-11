import { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { tipCellLabel, type TipCell } from '@/lib/tips';
import { useTheme } from '@/theme';

/**
 * The tips total, opening to where the tips came from: one line per order
 * type and payment method that has any — "Dine-in · Cash", "Delivery ·
 * Online" — so nine lines at most. Dine-out is already counted as dine-in by
 * the server.
 *
 * Used wherever a tips total is shown, so the breakdown reads the same on the
 * dashboard, at shift close and in a shift's detail. Mirrors the web's
 * TipsBreakdown.
 */
export function TipsBreakdown({
  total,
  cells,
  money,
  label = 'Tips',
  hint,
  hideTotal = false,
  defaultOpen = false,
  style,
}: {
  total: number;
  cells: TipCell[];
  money: (amount: number) => string;
  label?: string;
  /** A line under the total, e.g. "not counted in sales". */
  hint?: string;
  /** For a card whose headline figure already is the tips total. */
  hideTotal?: boolean;
  defaultOpen?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const canOpen = cells.length > 0;

  const head = (
    <>
      <View style={styles.label}>
        <Text variant="small" color="mutedForeground" style={styles.shrink}>
          {label}
        </Text>
        {canOpen ? (
          <ChevronDown
            size={14}
            color={theme.colors.mutedForeground}
            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
          />
        ) : null}
      </View>
      {hideTotal ? null : <Text variant="smallMedium">{money(total)}</Text>}
    </>
  );

  return (
    <View style={style}>
      {canOpen ? (
        <Pressable
          onPress={() => setOpen((o) => !o)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={styles.head}
        >
          {head}
        </Pressable>
      ) : (
        // Nothing to open: a plain line, not a button that does nothing.
        <View style={styles.head}>{head}</View>
      )}
      {hint ? (
        <Text variant="caption" color="mutedForeground">
          {hint}
        </Text>
      ) : null}
      {open && canOpen ? (
        <View style={[styles.cells, { borderLeftColor: theme.colors.border }]}>
          {cells.map((cell) => (
            <View key={`${cell.orderType}:${cell.method}`} style={styles.cell}>
              <Text variant="caption" color="mutedForeground" style={styles.shrink}>
                {tipCellLabel(cell)}
              </Text>
              <Text variant="caption">{money(cell.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  // A long label wraps in its own column rather than pushing the amount off the card.
  shrink: { flexShrink: 1 },
  cells: { marginTop: 6, gap: 2, borderLeftWidth: 2, paddingLeft: 8 },
  cell: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
