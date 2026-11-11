import { Pressable, StyleSheet, View } from 'react-native';

import { Input, Text } from '@/components/ui';
import { paymentMethodLabel } from '@/lib/payment';
import { tipFromReceived, type SettlePlan, type TipMethod } from '@/lib/tips';
import { tint, useTheme } from '@/theme';

type Money = (amount: number) => string;

/**
 * "How much did you receive?" — shown under the payment method when the
 * owner records tips for it. Mirrors the web's TipEntry.
 *
 * The cashier types what they KEPT (after any change given back); whatever is
 * above the bill is the tip. Leaving it blank means exactly the bill, so a
 * payment without a tip is still one tap.
 */
export function AmountReceived({
  total,
  method,
  value,
  onChange,
  money,
}: {
  total: number;
  method: TipMethod;
  value: string;
  onChange: (text: string) => void;
  money: Money;
}) {
  const theme = useTheme();
  const { tip, short, blank } = tipFromReceived(total, value);

  const label = `Amount received in ${paymentMethodLabel(method).toLowerCase()}`;
  const neutral = blank
    ? 'What you kept, after any change. Anything above the bill is recorded as a tip.'
    : 'Exactly the bill. No tip.';
  const color = short > 0 ? theme.colors.destructive : theme.colors.success;

  return (
    <View style={[styles.box, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      <Input
        label={label}
        accessibilityLabel={label}
        // What the line under the box says, for a screen reader on the field.
        accessibilityHint={
          short > 0
            ? `Less than the bill by ${money(short)}`
            : tip > 0
              ? `Tip, not counted in sales: ${money(tip)}`
              : neutral
        }
        keyboardType="decimal-pad"
        placeholder={String(total)}
        value={value}
        onChangeText={onChange}
      />
      {short > 0 || tip > 0 ? (
        <View style={styles.line}>
          <Text variant="caption" style={{ color }}>
            {short > 0 ? 'Less than the bill by' : 'Tip, not counted in sales'}
          </Text>
          <Text
            variant="caption"
            style={[{ color }, short > 0 ? null : { fontFamily: theme.fontFamily.bodyMedium }]}
          >
            {money(short > 0 ? short : tip)}
          </Text>
        </View>
      ) : (
        <Text variant="caption" color="mutedForeground">
          {neutral}
        </Text>
      )}
    </View>
  );
}

/**
 * The bottom line of the split boxes once they add up to more than the bill:
 * the extra is a tip, and the cashier says which method it came by. Only
 * methods the owner records tips for, and that received at least that much,
 * are offered.
 */
export function SplitTipPicker({
  plan,
  onPick,
  money,
}: {
  plan: SettlePlan;
  onPick: (method: TipMethod) => void;
  money: Money;
}) {
  const theme = useTheme();
  if (plan.tip <= 0) return null;

  const rule = {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  };

  if (!plan.eligible.length) {
    return (
      <View style={rule}>
        <Text variant="caption" style={{ color: theme.colors.destructive }}>
          {money(plan.tip)} over the bill, more than any one amount. Check the figures.
        </Text>
      </View>
    );
  }

  return (
    <View style={[rule, { gap: theme.spacing.sm }]}>
      <View style={styles.line}>
        <Text variant="caption" style={{ color: theme.colors.success }}>
          Tip, not counted in sales
        </Text>
        <Text
          variant="caption"
          style={{ color: theme.colors.success, fontFamily: theme.fontFamily.bodyMedium }}
        >
          {money(plan.tip)}
        </Text>
      </View>
      <View style={styles.pickRow}>
        <Text variant="caption" color="mutedForeground">
          Tip came by
        </Text>
        {plan.eligible.map((method) => {
          const active = plan.tipMethod === method;
          return (
            <Pressable
              key={method}
              onPress={() => onPick(method)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Tip came by ${paymentMethodLabel(method).toLowerCase()}`}
              accessibilityState={{ selected: active }}
              style={[
                styles.pick,
                {
                  borderRadius: theme.radius.sm,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  backgroundColor: active ? tint(theme.colors.primary, 0.1) : 'transparent',
                },
              ]}
            >
              <Text variant="caption">{paymentMethodLabel(method)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The same box the split editor sits in, so the two read as one family.
  box: { borderWidth: 1, padding: 12, gap: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  pick: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
});
