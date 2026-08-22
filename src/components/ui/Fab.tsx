import { Plus } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

import { Gradient } from './Gradient';

interface FabProps {
  onPress: () => void;
  accessibilityLabel: string;
  /** Defaults to a plus. */
  icon?: ReactNode;
}

/**
 * Floating action button — gradient circle pinned bottom-right. Replaces the
 * "Add" buttons that used to live in the removed page headers.
 */
export function Fab({ onPress, accessibilityLabel, icon }: FabProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { right: theme.spacing.xl, bottom: insets.bottom + theme.spacing.xl },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          theme.shadows.glow,
          { borderRadius: 28, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Gradient variant="primary" style={styles.circle}>
          {icon ?? <Plus size={26} color="#FFFFFF" />}
        </Gradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', zIndex: 10 },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
