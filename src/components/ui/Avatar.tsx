import { View, ViewStyle } from 'react-native';

import { initial } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

interface AvatarProps {
  name?: string | null;
  size?: number;
  style?: ViewStyle;
}

/**
 * Initial avatar. On web these use the primary gradient; a solid primary fill
 * reads the same at small sizes and avoids pulling in a gradient dependency.
 */
export function Avatar({ name, size = 40, style }: AvatarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        variant="bodySemibold"
        style={{ color: theme.colors.primaryForeground, fontSize: size * 0.4 }}
      >
        {initial(name)}
      </Text>
    </View>
  );
}
