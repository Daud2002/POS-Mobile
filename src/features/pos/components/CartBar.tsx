import { ArrowRight, ShoppingCart } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Gradient } from '@/components/ui/Gradient';
import { Text } from '@/components/ui/Text';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useTheme } from '@/theme/ThemeProvider';

interface CartBarProps {
  itemCount: number;
  total: number;
  onPress: () => void;
}

/**
 * Floating checkout bar above the tab bar — gradient fill, glow shadow, running
 * total. The mobile stand-in for the web's always-visible cart pane: the
 * cashier sees the total without opening anything, one tap reaches checkout.
 */
export function CartBar({ itemCount, total, onPress }: CartBarProps) {
  const theme = useTheme();
  const { format } = useStoreCurrency();

  if (itemCount === 0) return null;

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${itemCount} items, total ${format(total)}`}
        style={({ pressed }) => [
          theme.shadows.glow,
          {
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Gradient
          variant="primary"
          style={[styles.bar, { padding: theme.spacing.lg, gap: theme.spacing.md }]}
        >
          <View
            style={[
              styles.badge,
              { backgroundColor: '#FFFFFF2E', borderRadius: theme.radius.full },
            ]}
          >
            <ShoppingCart size={16} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text variant="caption" style={{ color: '#FFFFFFB8' }}>
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </Text>
            <Text variant="bodySemibold" style={{ color: '#FFFFFF' }}>
              View order
            </Text>
          </View>

          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: theme.fontFamily.headingBold,
              fontSize: 19,
            }}
          >
            {format(total)}
          </Text>
          <ArrowRight size={18} color="#FFFFFF" />
        </Gradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
