import { Image, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** The single source for the app mark, so a logo change lands everywhere. */
export const LOGO_SOURCE = require('../../../assets/pos_logo.png');

export interface LogoProps {
  size?: number;
  /**
   * Draws the mark on a white rounded tile.
   *
   * The logo is dark navy with a transparent background, so it disappears on
   * dark surfaces — anywhere it sits on the dark hero or a dark theme, it needs
   * a light ground behind it.
   */
  plated?: boolean;
  style?: ViewStyle;
}

export function Logo({ size = 64, plated = false, style }: LogoProps) {
  const theme = useTheme();

  const image = (
    <Image
      source={LOGO_SOURCE}
      style={{ width: size, height: size }}
      resizeMode="contain"
      // Decorative: the product name always sits alongside it.
      accessible={false}
    />
  );

  if (!plated) return <View style={style}>{image}</View>;

  const plateSize = Math.round(size * 1.32);

  return (
    <View
      style={[
        styles.plate,
        {
          width: plateSize,
          height: plateSize,
          borderRadius: theme.radius.xl,
          backgroundColor: '#FFFFFF',
        },
        style,
      ]}
    >
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: 'center', justifyContent: 'center' },
});
