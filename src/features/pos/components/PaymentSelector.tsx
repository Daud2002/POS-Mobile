import { Banknote, CreditCard, Globe, Clock } from 'lucide-react-native';
import { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PaymentMethod } from '@/api/types';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

const METHOD_ICONS: Record<PaymentMethod, ComponentType<{ size?: number; color?: string }>> = {
  cash: Banknote,
  card: CreditCard,
  online: Globe,
  check: Banknote,
};

const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
];

interface PaymentSelectorProps {
  value: PaymentMethod | null;
  isUnpaid: boolean;
  /** Unpaid is only offered once a customer is attached — it's a credit sale. */
  allowUnpaid: boolean;
  onSelect: (method: PaymentMethod) => void;
  onSelectUnpaid: () => void;
}

/** Payment method chooser, matching the web POS's Cash / Card / Online / Unpaid row. */
export function PaymentSelector({
  value,
  isUnpaid,
  allowUnpaid,
  onSelect,
  onSelectUnpaid,
}: PaymentSelectorProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="overline" color="mutedForeground">
        Payment
      </Text>

      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {allowUnpaid ? (
          <MethodTile
            label="Unpaid"
            Icon={Clock}
            active={isUnpaid}
            onPress={onSelectUnpaid}
          />
        ) : null}

        {METHODS.map(({ value: method, label }) => (
          <MethodTile
            key={method}
            label={label}
            Icon={METHOD_ICONS[method]}
            active={!isUnpaid && value === method}
            onPress={() => onSelect(method)}
          />
        ))}
      </View>
    </View>
  );
}

function MethodTile({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.tile,
        {
          borderRadius: theme.radius.md,
          borderColor: active ? theme.colors.primary : theme.colors.border,
          backgroundColor: active
            ? theme.tint(theme.colors.primary, 0.1)
            : theme.colors.card,
          gap: theme.spacing.xs,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icon size={18} color={active ? theme.colors.primary : theme.colors.mutedForeground} />
      <Text
        variant="caption"
        style={{ color: active ? theme.colors.primary : theme.colors.mutedForeground }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
});
