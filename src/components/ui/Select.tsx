import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Sheet } from './Sheet';
import { Text } from './Text';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}

/** Dropdown replacement — opens a sheet of options rather than a native picker. */
export function Select({
  label,
  value,
  options,
  placeholder = 'Select…',
  error,
  onChange,
}: SelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {label ? <Text variant="smallMedium">{label}</Text> : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select an option'}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: 44,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: error ? theme.colors.destructive : theme.colors.input,
          backgroundColor: pressed ? theme.colors.muted : theme.colors.card,
        })}
      >
        <Text
          variant="body"
          color={selected ? 'foreground' : 'mutedForeground'}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={theme.colors.mutedForeground} />
      </Pressable>

      {error ? (
        <Text variant="caption" color="destructive">
          {error}
        </Text>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={label ?? 'Select'}
        scrollable={false}
        maxHeightRatio={0.7}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
            {options.length === 0 ? (
              <Text variant="small" color="mutedForeground">
                Nothing to choose from yet.
              </Text>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      padding: theme.spacing.lg,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: pressed ? theme.colors.muted : theme.colors.card,
                    })}
                  >
                    <Text variant="body" style={{ flex: 1 }}>
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Check size={18} color={theme.colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}
