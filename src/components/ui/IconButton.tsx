import { ReactNode } from 'react';
import { Pressable, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export type IconButtonTone = 'default' | 'destructive' | 'primary';

interface IconButtonProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: IconButtonTone;
  disabled?: boolean;
  size?: number;
  style?: ViewStyle;
}

/**
 * Square icon button for table/list action columns. Web equivalent:
 * `p-2 hover:bg-muted rounded-lg`, destructive variant `hover:bg-destructive/10`.
 */
export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  tone = 'default',
  disabled = false,
  size = 36,
  style,
}: IconButtonProps) {
  const theme = useTheme();

  const background =
    tone === 'destructive'
      ? theme.tint(theme.colors.destructive, 0.1)
      : tone === 'primary'
        ? theme.tint(theme.colors.primary, 0.1)
        : theme.colors.muted;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: theme.radius.md,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
