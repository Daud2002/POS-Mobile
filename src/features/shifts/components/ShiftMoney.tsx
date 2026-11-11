import { StyleSheet, View } from 'react-native';

import { KeyValueRow } from '@/components/data';
import { Text } from '@/components/ui';
import { TipsBreakdown } from '@/features/restaurant/components/TipsBreakdown';
import {
  drawerNotes,
  drawerRows,
  hasTips,
  takingsRows,
  type ShiftFigures,
} from '@/lib/shiftMaths';
import { useTheme } from '@/theme';

type Money = (amount: number) => string;

/**
 * What a shift took, by method. Mirrors the web's ShiftMoney.
 *
 * Without tips this is the list it always was. With tips each method reads
 * across — received, of which tips, leaving sales — so the cashier and the
 * owner see the same thing: what came in, and how much of it is not the
 * restaurant's. The tips total opens to its order-type breakdown.
 */
export function ShiftTakings({
  figures,
  money,
  totalLabel = 'Total takings',
}: {
  figures: ShiftFigures;
  money: Money;
  totalLabel?: string;
}) {
  const theme = useTheme();
  const rows = takingsRows(figures);

  if (!hasTips(figures)) {
    return (
      <View style={styles.rows}>
        {/* Exactly the four lines this list always had: cheques are in the total, not listed. */}
        {rows
          .filter((row) => row.key !== 'other')
          .map((row) => (
            <KeyValueRow
              key={row.key}
              label={row.key === 'total' ? totalLabel : row.key === 'cash' ? 'Cash sales' : row.label}
              value={money(row.sales)}
            />
          ))}
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View>
        <View style={[styles.tableRow, { paddingBottom: theme.spacing.xs }]}>
          <View style={styles.methodCell} />
          {['Received', 'Tips', 'Sales'].map((heading) => (
            <Text
              key={heading}
              variant="overline"
              color="mutedForeground"
              style={styles.amountCell}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {heading}
            </Text>
          ))}
        </View>
        {rows.map((row) => {
          const total = row.key === 'total';
          const tips = row.tips > 0 ? money(row.tips) : '—';
          const amount = (text: string) => (
            <Text
              variant={total ? 'smallMedium' : 'small'}
              style={styles.amountCell}
              // Three figures share a phone's width: shrink a long one rather
              // than wrap it or cut it off.
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {text}
            </Text>
          );
          return (
            <View
              key={row.key}
              // Read out as one line; the column headings are not announced per cell.
              accessible
              accessibilityLabel={`${row.label}: received ${money(row.received)}, tips ${
                row.tips > 0 ? tips : 'none'
              }, sales ${money(row.sales)}`}
              style={[
                styles.tableRow,
                { paddingVertical: theme.spacing.xs },
                total
                  ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }
                  : null,
              ]}
            >
              <Text
                variant={total ? 'smallMedium' : 'small'}
                color={total ? 'foreground' : 'mutedForeground'}
                style={styles.methodCell}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              {amount(money(row.received))}
              {amount(tips)}
              {amount(money(row.sales))}
            </View>
          );
        })}
      </View>
      <TipsBreakdown
        total={figures.tipTotal}
        cells={figures.tipsBreakdown}
        money={money}
        label="Tips, by order type"
        hint="Tips are not counted in sales."
      />
    </View>
  );
}

/**
 * The drawer arithmetic, ending in the cash to hand over. The lines and their
 * wording come from lib/shiftMaths so the sheet, the detail and the printed
 * slip cannot drift apart.
 */
export function ShiftDrawer({ figures, money }: { figures: ShiftFigures; money: Money }) {
  const theme = useTheme();
  const tipped = hasTips(figures);

  return (
    <View style={styles.rows}>
      {drawerRows(figures).map((row) => {
        const line = (
          <KeyValueRow
            key={row.key}
            label={`${row.sign ? `${row.sign} ` : ''}${row.label}`}
            value={money(row.amount)}
            // The bottom line stands out once tips are in the sum above it. A
            // shift without tips keeps the plain rows it always had.
            emphasis={tipped && !!row.result}
          />
        );
        return tipped && row.result ? (
          <View
            key={row.key}
            style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }}
          >
            {line}
          </View>
        ) : (
          line
        );
      })}
      {drawerNotes(figures, money).map((note) => (
        <Text
          key={note}
          variant="caption"
          color="mutedForeground"
          style={{ paddingTop: theme.spacing.xs }}
        >
          {note}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The spacing the close sheet's rows always had.
  rows: { gap: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodCell: { flex: 0.9 },
  amountCell: { flex: 1.2, textAlign: 'right' },
});
