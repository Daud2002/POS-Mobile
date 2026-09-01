import { Pressable, ScrollView, View } from 'react-native';

import { ICON_GROUPS } from '@/constants/emojis';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

interface IconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
  error?: string;
  label?: string;
  /** Shown under the shelf — e.g. that a dish inherits its category's icon. */
  hint?: string;
  /** Off where the icon is required, so the field cannot be emptied. */
  allowClear?: boolean;
}

/**
 * The icon field for a product or a category.
 *
 * The shelf scrolls inside a fixed 200pt window rather than laying seventy
 * icons out flat: this sits inside a form sheet, and an inline grid that tall
 * would push Name and Price below the fold before either could be typed.
 */
export function IconPicker({
  value,
  onChange,
  error,
  label = 'Icon',
  hint,
  allowClear = false,
}: IconPickerProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="smallMedium" style={{ flex: 1 }}>
          {label}
        </Text>
        {allowClear && value ? (
          <Pressable onPress={() => onChange('')} accessibilityRole="button">
            <Text variant="caption" color="mutedForeground">
              Clear
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        nestedScrollEnabled
        style={{
          maxHeight: 200,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
        }}
        contentContainerStyle={{ padding: theme.spacing.sm, gap: theme.spacing.md }}
      >
        {ICON_GROUPS.map((group) => (
          <View key={group.label} style={{ gap: theme.spacing.sm }}>
            <Text variant="caption" color="mutedForeground">
              {group.label}
            </Text>

            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
            >
              {group.icons.map((icon) => {
                const selected = value === icon;

                return (
                  <Pressable
                    key={icon}
                    onPress={() => onChange(icon)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select icon ${icon}`}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => ({
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected
                        ? theme.tint(theme.colors.primary, 0.1)
                        : theme.colors.card,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 22, lineHeight: 28 }}>{icon}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {hint ? (
        <Text variant="caption" color="mutedForeground">
          {hint}
        </Text>
      ) : null}

      {error ? (
        <Text variant="caption" color="destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
