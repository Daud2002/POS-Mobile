import { ChevronDown, Printer, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Order } from '@/api/types';
import { KeyValueRow } from '@/components/data/KeyValueRow';
import { StatusPill } from '@/components/data/StatusPill';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Text } from '@/components/ui/Text';
import { paymentLabel } from '@/constants/statuses';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { displayDate, timeLabel } from '@/lib/date';
import { orderNumberLabel, toNumber } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

interface OrderCardProps {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onReprint: (orderId: string) => void;
  reprinting: boolean;
  /** Only shown when the caller can mark orders paid (store owner screens). */
  onMarkPaid?: (order: Order) => void;
  markingPaid?: boolean;
}

/**
 * Expandable order row.
 *
 * The web cashier screen already uses an accordion for this, so the pattern
 * carries over directly — but its status pills render unstyled because it keys
 * off a `completed`/`preparing` vocabulary the POS never writes. StatusPill
 * uses the one canonical map instead.
 */
export function OrderCard({
  order,
  expanded,
  onToggle,
  onReprint,
  reprinting,
  onMarkPaid,
  markingPaid = false,
}: OrderCardProps) {
  const theme = useTheme();
  const { format } = useStoreCurrency();

  const rotation = useSharedValue(expanded ? 1 : 0);
  rotation.value = withTiming(expanded ? 1 : 0, { duration: 180 });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  const items = order.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const canMarkPaid = !!onMarkPaid && order.status === 'unpaid';

  return (
    <Card padding="none" onPress={onToggle}>
      {/* Header ------------------------------------------------------- */}
      <View style={[styles.header, { padding: theme.spacing.lg, gap: theme.spacing.md }]}>
        <View style={{ flex: 1 }}>
          <View style={[styles.titleRow, { gap: theme.spacing.sm }]}>
            <Text variant="bodySemibold">#{orderNumberLabel(order.orderNumber)}</Text>
            <StatusPill status={order.status} />
          </View>

          <Text
            variant="caption"
            color="mutedForeground"
            style={{ marginTop: theme.spacing.xxs }}
          >
            {displayDate(order.createdAt)} · {timeLabel(order.createdAt)} ·{' '}
            {paymentLabel(order.paymentMethod)}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="money">{format(order.total)}</Text>
          <Text variant="caption" color="mutedForeground">
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </Text>
        </View>

        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color={theme.colors.mutedForeground} />
        </Animated.View>
      </View>

      {/* Expanded body ------------------------------------------------ */}
      {expanded ? (
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <Divider />

          {order.customerName || order.customer?.name ? (
            <View style={{ paddingVertical: theme.spacing.md }}>
              <Text variant="overline" color="mutedForeground">
                Customer
              </Text>
              <Text variant="smallMedium" style={{ marginTop: theme.spacing.xxs }}>
                {order.customerName ?? order.customer?.name}
              </Text>
            </View>
          ) : null}

          <Text
            variant="overline"
            color="mutedForeground"
            style={{ marginTop: theme.spacing.md }}
          >
            Items
          </Text>

          <View style={{ marginTop: theme.spacing.sm }}>
            {items.map((item) => (
              <View
                key={item.id}
                style={[styles.itemRow, { paddingVertical: theme.spacing.xs }]}
              >
                <Text variant="small" style={{ flex: 1 }} numberOfLines={2}>
                  {item.productName ?? 'Item'}
                </Text>
                <Text variant="caption" color="mutedForeground" style={{ width: 64 }}>
                  × {item.quantity}
                </Text>
                <Text variant="smallMedium">{format(item.total)}</Text>
              </View>
            ))}
          </View>

          <Divider spacing="md" />

          <KeyValueRow label="Subtotal" value={format(order.subtotal)} />
          {toNumber(order.discount) > 0 ? (
            <KeyValueRow
              label="Discount"
              value={`− ${format(order.discount)}`}
              valueColor="success"
            />
          ) : null}
          {toNumber(order.tax) > 0 ? (
            <KeyValueRow label="Tax" value={format(order.tax)} />
          ) : null}
          <KeyValueRow label="Total" value={format(order.total)} emphasis />

          {order.notes ? (
            <Text
              variant="caption"
              color="mutedForeground"
              style={{ marginTop: theme.spacing.md }}
            >
              Note: {order.notes}
            </Text>
          ) : null}

          <View style={[styles.actions, { gap: theme.spacing.md, marginTop: theme.spacing.lg }]}>
            <Button
              label={reprinting ? 'Printing…' : 'Reprint'}
              variant="outline"
              size="sm"
              loading={reprinting}
              disabled={reprinting}
              icon={<Printer size={15} color={theme.colors.foreground} />}
              onPress={() => onReprint(order.id)}
              style={{ flex: 1 }}
            />

            {canMarkPaid ? (
              <Button
                label="Mark Paid"
                size="sm"
                loading={markingPaid}
                disabled={markingPaid}
                icon={<Wallet size={15} color={theme.colors.primaryForeground} />}
                onPress={() => onMarkPaid?.(order)}
                style={{ flex: 1 }}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row' },
});
