import { View, ViewStyle } from 'react-native';

import { Spacing } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

interface DividerProps {
  /** Vertical margin above and below. */
  spacing?: Spacing;
  style?: ViewStyle;
}

/** The `divide-y divide-border` rule used between list rows on web. */
export function Divider({ spacing = 'none', style }: DividerProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: theme.colors.border,
          marginVertical: theme.spacing[spacing],
        },
        style,
      ]}
    />
  );
}
