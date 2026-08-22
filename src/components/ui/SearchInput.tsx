import { Search, X } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Input, InputProps } from './Input';

export interface SearchInputProps extends Omit<InputProps, 'leading' | 'trailing'> {
  value: string;
  onChangeText: (text: string) => void;
}

/** Search field with a magnifier and a clear button once text is entered. */
export function SearchInput({ value, onChangeText, ...rest }: SearchInputProps) {
  const theme = useTheme();

  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
      leading={<Search size={18} color={theme.colors.mutedForeground} />}
      trailing={
        value.length > 0 ? (
          <Pressable
            onPress={() => onChangeText('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <X size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        ) : null
      }
      {...rest}
    />
  );
}
