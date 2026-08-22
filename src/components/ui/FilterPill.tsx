import { Pressable, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

/**
 * The single most reused pattern in the web app: it is the POS category
 * selector, the Orders status filter, and the payment-method selector.
 *
 * Web: `px-3 py-1.5 rounded-full text-xs font-medium border`, active
 * `bg-primary text-primary-foreground border-primary`.
 */
export function FilterPill({ label, active, onPress }: FilterPillProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.pill,
        {
          borderRadius: theme.radius.full,
          backgroundColor: active ? theme.colors.primary : theme.colors.card,
          borderColor: active ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
        active ? theme.shadows.sm : null,
      ]}
    >
      <Text
        variant="smallMedium"
        style={{
          color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export interface FilterPillOption<T extends string> {
  value: T;
  label: string;
}

interface FilterPillRowProps<T extends string> {
  options: ReadonlyArray<FilterPillOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Horizontally scrollable — needed when there are many categories. */
  scrollable?: boolean;
  style?: ViewStyle;
}

/** A row of mutually exclusive pills. */
export function FilterPillRow<T extends string>({
  options,
  value,
  onChange,
  scrollable = true,
  style,
}: FilterPillRowProps<T>) {
  const theme = useTheme();

  const pills = options.map((option) => (
    <FilterPill
      key={option.value}
      label={option.label}
      active={option.value === value}
      onPress={() => onChange(option.value)}
    />
  ));

  if (!scrollable) {
    return <View style={[styles.row, { gap: theme.spacing.sm }, style]}>{pills}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { gap: theme.spacing.sm }]}
      style={style}
    >
      {pills}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
