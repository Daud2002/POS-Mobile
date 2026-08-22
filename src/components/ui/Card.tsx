import { ReactNode } from 'react';
import { Pressable, View, ViewStyle } from 'react-native';

import { Shadow, Spacing } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

export interface CardProps {
  children: ReactNode;
  /** Web equivalent: `p-5` for panels, `p-4` for compact cards and tiles. */
  padding?: Spacing;
  shadow?: Shadow;
  /** Turns the card into a pressable tile (POS product grid, list rows). */
  onPress?: () => void;
  /** Draws the primary-colored selected border used by POS tiles. */
  selected?: boolean;
  style?: ViewStyle;
}

/**
 * The canonical card. On web this is a hand-rolled
 * `bg-card rounded-xl border border-border p-5` — the shadcn <Card> primitive
 * is essentially unused by the app's pages, so this ports the real one.
 */
export function Card({
  children,
  padding = 'xl',
  shadow = 'sm',
  onPress,
  selected = false,
  style,
}: CardProps) {
  const theme = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    // In light mode the soft shadow does the separating; the border only needs
    // to catch the edge. Dark mode has no visible shadows, so the border works
    // harder there.
    borderColor: selected
      ? theme.colors.primary
      : theme.isDark
        ? theme.colors.border
        : theme.tint(theme.colors.border, 0.6),
    padding: theme.spacing[padding],
    ...theme.shadows[shadow],
  };

  if (!onPress) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.75 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}
