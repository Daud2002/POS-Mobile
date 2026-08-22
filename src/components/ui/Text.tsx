import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

import { ColorName } from '@/theme/colors';
import { TextVariant } from '@/theme/typography';
import { useTheme } from '@/theme/ThemeProvider';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** A theme color token name. Defaults to `foreground`. */
  color?: ColorName;
  align?: TextStyle['textAlign'];
}

/**
 * The only text primitive in the app. Screens pick a named variant instead of
 * declaring raw fontSize/fontFamily pairs, which is what keeps the type scale
 * consistent and the heading font applied.
 */
export function Text({
  variant = 'body',
  color = 'foreground',
  align,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();

  return (
    <RNText
      style={[
        theme.text[variant] as TextStyle,
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}
