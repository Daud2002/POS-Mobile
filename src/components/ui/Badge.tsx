import { StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export type BadgeTone =
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'
  | 'primary'
  | 'accent'
  | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Leading status dot — makes state pills scannable without reading them. */
  dot?: boolean;
  style?: ViewStyle;
}

/**
 * Pill badge: 12% tint background, full-strength foreground, optional leading
 * dot for status pills.
 */
export function Badge({ label, tone = 'neutral', dot = false, style }: BadgeProps) {
  const theme = useTheme();

  const foreground =
    tone === 'neutral' ? theme.colors.mutedForeground : theme.colors[tone];
  const background =
    tone === 'neutral' ? theme.colors.muted : theme.tint(theme.colors[tone], 0.12);

  return (
    <View
      style={[
        styles.badge,
        { borderRadius: theme.radius.full, backgroundColor: background },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: foreground }]} /> : null}
      <Text variant="caption" style={{ color: foreground, textTransform: 'capitalize' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
