import { ActivityIndicator, View } from 'react-native';

import { ColorName } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

interface SpinnerProps {
  size?: 'small' | 'large';
  color?: ColorName;
  /** Centers the spinner in the remaining space — for full-screen loading. */
  fill?: boolean;
}

export function Spinner({ size = 'small', color = 'primary', fill = false }: SpinnerProps) {
  const theme = useTheme();
  const indicator = <ActivityIndicator size={size} color={theme.colors[color]} />;

  if (!fill) return indicator;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {indicator}
    </View>
  );
}
