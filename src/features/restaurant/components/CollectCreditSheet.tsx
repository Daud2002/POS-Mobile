import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';

import { Button, Input, Sheet, Text } from '@/components/ui';
import { toNumber } from '@/lib/format';
import { orderDestination, orderLabel } from '@/lib/orderLabel';
import {
  EMPTY_SPLIT_TEXT,
  SPLIT_METHODS,
  isSplitBalanced,
  parseSplit,
  paymentMethodLabel,
  splitRemaining,
  type SplitMethod,
  type SplitText,
} from '@/lib/payment';
import { tint, useTheme } from '@/theme';
import type { RestaurantOrder } from '@/api/types';

const METHODS = ['cash', 'card', 'online', 'partial'] as const;

interface CollectCreditSheetProps {
  /** The credit order being paid; null keeps the sheet closed. */
  order: RestaurantOrder | null;
  customerName: string;
  money: (amount: number) => string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (body: { paymentMethod: string; split?: { cash: number; card: number; online: number } }) => void;
}

/**
 * Taking the money for a credit order: how it was paid, exactly as at the
 * till — one method, or a split that must add up to the total. Mirrors the
 * web's CollectCreditDialog.
 */
export function CollectCreditSheet({
  order,
  customerName,
  money,
  submitting,
  onClose,
  onConfirm,
}: CollectCreditSheetProps) {
  const theme = useTheme();
  const [method, setMethod] = useState<string>('cash');
  const [split, setSplit] = useState<SplitText>(EMPTY_SPLIT_TEXT);

  // A fresh choice for every order opened.
  const orderId = order?.id;
  useEffect(() => {
    if (orderId) {
      setMethod('cash');
      setSplit(EMPTY_SPLIT_TEXT);
    }
  }, [orderId]);

  const total = toNumber(order?.total);
  const parsed = useMemo(() => parseSplit(split), [split]);
  const left = splitRemaining(total, parsed);
  const balanced = isSplitBalanced(total, parsed);
  const partial = method === 'partial';

  const fillRemaining = (m: SplitMethod) => {
    if (left <= 0) return;
    setSplit((s) => ({ ...s, [m]: String(Math.round((parsed[m] + left) * 100) / 100) }));
  };

  return (
    <Sheet
      open={!!order}
      onClose={() => !submitting && onClose()}
      title="Mark credit order paid"
      description={order ? `${orderLabel(order)} · ${orderDestination(order)} · ${customerName}` : undefined}
      footer={
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button variant="outline" label="Cancel" onPress={onClose} disabled={submitting} style={{ flex: 1 }} />
          <Button
            label="Mark paid"
            loading={submitting}
            disabled={partial && !balanced}
            onPress={() => onConfirm(partial ? { paymentMethod: method, split: parsed } : { paymentMethod: method })}
            icon={<BadgeCheck size={16} color={theme.colors.primaryForeground} />}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        <View
          style={[
            styles.due,
            { backgroundColor: theme.colors.muted, borderRadius: theme.radius.md, padding: theme.spacing.md },
          ]}
        >
          <Text variant="small" color="mutedForeground">
            Amount due
          </Text>
          <Text variant="h3">{money(total)}</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text variant="smallMedium" color="mutedForeground">
            Paid by
          </Text>
          <View style={styles.pills}>
            {METHODS.map((m) => {
              const active = method === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMethod(m)}
                  style={[
                    styles.pill,
                    {
                      borderRadius: theme.radius.md,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      backgroundColor: active ? tint(theme.colors.primary, 0.1) : 'transparent',
                    },
                  ]}
                >
                  <Text variant="small">{paymentMethodLabel(m)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {partial && (
          <View
            style={[
              styles.split,
              { borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.sm },
            ]}
          >
            {SPLIT_METHODS.map((m) => (
              <View key={m} style={styles.splitRow}>
                <Text variant="caption" color="mutedForeground" style={{ width: 52 }}>
                  {paymentMethodLabel(m)}
                </Text>
                <Input
                  containerStyle={{ flex: 1 }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  value={split[m]}
                  onChangeText={(text) => setSplit((s) => ({ ...s, [m]: text }))}
                />
                <Pressable onPress={() => fillRemaining(m)} disabled={left <= 0} hitSlop={8}>
                  <Text variant="smallMedium" color={left <= 0 ? 'mutedForeground' : 'primary'}>
                    Rest
                  </Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.splitRow}>
              <Text
                variant="caption"
                style={{
                  flex: 1,
                  color: balanced ? theme.colors.success : left > 0 ? theme.colors.warning : theme.colors.destructive,
                }}
              >
                {balanced ? 'Adds up to the bill' : left > 0 ? 'Still to allocate' : 'Over the bill by'}
              </Text>
              <Text variant="caption">{money(balanced ? total : Math.abs(left))}</Text>
            </View>
          </View>
        )}

        <Text variant="caption" color="mutedForeground">
          The payment goes on your shift and counts in today's sales.
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  due: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { flex: 1, borderWidth: 1, alignItems: 'center', paddingVertical: 10 },
  split: { borderWidth: 1, gap: 8 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
