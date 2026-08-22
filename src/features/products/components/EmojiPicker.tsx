import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { PRODUCT_EMOJIS } from '@/constants/emojis';
import { useTheme } from '@/theme/ThemeProvider';

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
  error?: string;
}

/**
 * Product icon picker.
 *
 * The `image` field holds an emoji rather than a URL, and these are the exact
 * 16 options the web Products form offers.
 */
export function EmojiPicker({ value, onChange, error }: EmojiPickerProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="smallMedium">Icon</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {PRODUCT_EMOJIS.map((emoji) => {
          const selected = value === emoji;

          return (
            <Pressable
              key={emoji}
              onPress={() => onChange(emoji)}
              accessibilityRole="button"
              accessibilityLabel={`Select icon ${emoji}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
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
              <Text style={{ fontSize: 22, lineHeight: 28 }}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text variant="caption" color="destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
