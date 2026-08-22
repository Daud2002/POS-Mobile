import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Gradient } from './Gradient';
import { Text } from './Text';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Rendered before the label — pass a lucide icon. */
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 38, md: 46, lg: 54 };
const PADDING: Record<ButtonSize, number> = { sm: 14, md: 18, lg: 24 };

/**
 * Button variants mirror the web app's shadcn set, with one upgrade: the
 * primary variant is filled with the brand gradient (the web `.gradient-primary`)
 * and carries the primary glow shadow, so CTAs read as the most important
 * element on any screen.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const isGradient = variant === 'primary';

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.colors.primary, fg: theme.colors.primaryForeground },
    secondary: { bg: theme.colors.secondary, fg: theme.colors.secondaryForeground },
    outline: {
      bg: 'transparent',
      fg: theme.colors.foreground,
      border: theme.colors.border,
    },
    ghost: { bg: 'transparent', fg: theme.colors.foreground },
    destructive: {
      bg: theme.colors.destructive,
      fg: theme.colors.destructiveForeground,
    },
  };

  const { bg, fg, border } = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          paddingHorizontal: PADDING[size],
          borderRadius: theme.radius.md,
          backgroundColor: isGradient ? 'transparent' : bg,
          borderWidth: border ? 1 : 0,
          borderColor: border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          overflow: 'hidden',
        },
        isGradient && !isDisabled ? theme.shadows.glow : null,
        style,
      ]}
      {...rest}
    >
      {isGradient ? <Gradient variant="primary" style={styles.fill} /> : null}

      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        icon && <View style={styles.icon}>{icon}</View>
      )}
      <Text
        variant={size === 'sm' ? 'smallMedium' : 'bodySemibold'}
        style={{ color: fg }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
