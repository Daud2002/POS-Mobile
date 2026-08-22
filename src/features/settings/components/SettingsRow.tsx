import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface SettingsRowProps {
  icon: ReactNode;
  label: string;
  description?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  /** Draws a separator below — set on every row but the last in a group. */
  divided?: boolean;
  /** Icon chip color. Varying it per row keeps a long menu scannable. */
  color?: string;
}

/** A tappable settings list row: tinted icon chip, label, description, chevron. */
export function SettingsRow({
  icon,
  label,
  description,
  onPress,
  trailing,
  divided = false,
  color,
}: SettingsRowProps) {
  const theme = useTheme();
  const chipColor = color ?? theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        {
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
          borderBottomWidth: divided ? 1 : 0,
          borderBottomColor: theme.colors.border,
          backgroundColor: pressed && onPress ? theme.colors.muted : 'transparent',
        },
      ]}
    >
      <View
        style={[
          styles.iconChip,
          {
            borderRadius: theme.radius.md,
            backgroundColor: theme.tint(chipColor, 0.11),
          },
        ]}
      >
        {icon}
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{label}</Text>
        {description ? (
          <Text
            variant="caption"
            color="mutedForeground"
            style={{ marginTop: theme.spacing.xxs }}
            numberOfLines={1}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconChip: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
