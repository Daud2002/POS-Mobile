import { Minus, Plus, Tag, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { DEFAULT_PRODUCT_EMOJI } from '@/constants/emojis';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useTheme } from '@/theme/ThemeProvider';

import { CartLine } from '../store/cart.store';

interface CartLineRowProps {
  line: CartLine;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  onApplyDiscount: (productId: string, perUnit: number) => void;
}

/**
 * One cart line: emoji, name, unit price, quantity stepper, and the per-unit
 * discount editor that the web POS exposes behind a Tag button.
 */
export function CartLineRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
  onApplyDiscount,
}: CartLineRowProps) {
  const theme = useTheme();
  const { format } = useStoreCurrency();

  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState(
    line.itemDiscountPerUnit > 0 ? String(line.itemDiscountPerUnit) : '',
  );

  const lineTotal = (line.price - line.itemDiscountPerUnit) * line.quantity;
  const exceedsStock = line.quantity > line.stock;

  const applyDiscount = () => {
    const parsed = Number(discountInput);
    // A discount larger than the unit price would make the line negative.
    const perUnit = Number.isFinite(parsed) ? Math.min(Math.max(0, parsed), line.price) : 0;
    onApplyDiscount(line.productId, perUnit);
    setEditingDiscount(false);
  };

  return (
    <View
      style={[
        styles.root,
        { paddingVertical: theme.spacing.md, gap: theme.spacing.md },
      ]}
    >
      <View style={[styles.top, { gap: theme.spacing.md }]}>
        <Text style={styles.emoji}>{line.image || DEFAULT_PRODUCT_EMOJI}</Text>

        <View style={{ flex: 1 }}>
          <Text variant="smallMedium" numberOfLines={2}>
            {line.name}
          </Text>
          <Text variant="caption" color="mutedForeground">
            {format(line.price)} each
            {line.itemDiscountPerUnit > 0
              ? ` · −${format(line.itemDiscountPerUnit)} off`
              : ''}
          </Text>
          {exceedsStock ? (
            <Text variant="caption" color="warning">
              Only {line.stock} in stock
            </Text>
          ) : null}
        </View>

        <Text variant="money">{format(lineTotal)}</Text>
      </View>

      <View style={[styles.controls, { gap: theme.spacing.sm }]}>
        <View style={[styles.stepper, { gap: theme.spacing.sm }]}>
          <IconButton
            accessibilityLabel={`Decrease ${line.name}`}
            onPress={() => onDecrement(line.productId)}
            size={32}
          >
            <Minus size={15} color={theme.colors.foreground} />
          </IconButton>

          <Text variant="bodySemibold" style={{ minWidth: 24, textAlign: 'center' }}>
            {line.quantity}
          </Text>

          <IconButton
            accessibilityLabel={`Increase ${line.name}`}
            onPress={() => onIncrement(line.productId)}
            size={32}
          >
            <Plus size={15} color={theme.colors.foreground} />
          </IconButton>
        </View>

        <View style={{ flex: 1 }} />

        <IconButton
          accessibilityLabel={`Discount ${line.name}`}
          onPress={() => setEditingDiscount((open) => !open)}
          tone={line.itemDiscountPerUnit > 0 ? 'primary' : 'default'}
          size={32}
        >
          <Tag
            size={15}
            color={
              line.itemDiscountPerUnit > 0
                ? theme.colors.primary
                : theme.colors.mutedForeground
            }
          />
        </IconButton>

        <IconButton
          accessibilityLabel={`Remove ${line.name}`}
          onPress={() => onRemove(line.productId)}
          tone="destructive"
          size={32}
        >
          <Trash2 size={15} color={theme.colors.destructive} />
        </IconButton>
      </View>

      {editingDiscount ? (
        <View style={[styles.discountRow, { gap: theme.spacing.sm }]}>
          <Input
            containerStyle={{ flex: 1 }}
            value={discountInput}
            onChangeText={setDiscountInput}
            placeholder="Discount per unit"
            keyboardType="decimal-pad"
            autoFocus
            onSubmitEditing={applyDiscount}
            returnKeyType="done"
          />
          <IconButton accessibilityLabel="Apply discount" onPress={applyDiscount} tone="primary">
            <Tag size={16} color={theme.colors.primary} />
          </IconButton>
          <IconButton
            accessibilityLabel="Cancel discount"
            onPress={() => setEditingDiscount(false)}
          >
            <X size={16} color={theme.colors.mutedForeground} />
          </IconButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  emoji: { fontSize: 26, lineHeight: 32 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  discountRow: { flexDirection: 'row', alignItems: 'center' },
});
