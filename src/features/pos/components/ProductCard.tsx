import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Product } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/constants/config';
import { DEFAULT_PRODUCT_EMOJI, iconFor } from '@/constants/emojis';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useTheme } from '@/theme/ThemeProvider';

interface ProductCardProps {
  product: Product;
  /** Quantity already in the cart, shown as a badge. */
  inCart: number;
  onPress: (product: Product) => void;
}

/**
 * A tappable product tile: icon in a tinted chip, name, price in brand green,
 * and a stock pill when it matters. Selected state = primary border + badge.
 */
export const ProductCard = memo(function ProductCard({
  product,
  inCart,
  onPress,
}: ProductCardProps) {
  const theme = useTheme();
  const { format } = useStoreCurrency();

  const threshold = product.lowStockAlertQuantity ?? DEFAULT_LOW_STOCK_THRESHOLD;
  const isLowStock = product.stock < threshold;
  const isOutOfStock = product.stock <= 0;

  return (
    <Card
      padding="lg"
      onPress={() => onPress(product)}
      selected={inCart > 0}
      style={{ flex: 1, opacity: isOutOfStock ? 0.45 : 1 }}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.emojiChip,
            {
              borderRadius: theme.radius.md,
              backgroundColor: theme.isDark
                ? theme.colors.muted
                : theme.tint(theme.colors.primary, 0.07),
            },
          ]}
        >
          <Text style={styles.emoji}>
            {iconFor(product, product.category, DEFAULT_PRODUCT_EMOJI)}
          </Text>
        </View>

        {inCart > 0 ? (
          <View
            style={[
              styles.badge,
              theme.shadows.sm,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.full,
              },
            ]}
          >
            <Text variant="caption" style={{ color: theme.colors.primaryForeground }}>
              {inCart}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        variant="smallMedium"
        numberOfLines={2}
        style={{ marginTop: theme.spacing.md, minHeight: 36 }}
      >
        {product.name}
      </Text>

      <View style={[styles.bottomRow, { marginTop: theme.spacing.xs }]}>
        <Text variant="money" style={{ color: theme.colors.primary }}>
          {format(product.price)}
        </Text>
      </View>

      {isOutOfStock ? (
        <StockPill label="Out of stock" color={theme.colors.destructive} />
      ) : isLowStock ? (
        <StockPill label={`${product.stock} left`} color={theme.colors.warning} />
      ) : null}
    </Card>
  );
});

function StockPill({ label, color }: { label: string; color: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.tint(color, 0.12),
        borderRadius: theme.radius.full,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginTop: theme.spacing.xs,
      }}
    >
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  emojiChip: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 27, lineHeight: 33 },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
});
