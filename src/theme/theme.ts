import { ColorTokens, darkColors, gradients, lightColors, tint } from './colors';
import { radius, shadows, spacing } from './layout';
import { fontFamily, fontSize, textVariants } from './typography';

export interface Theme {
  isDark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  text: typeof textVariants;
  gradients: typeof gradients;
  /** Convenience passthrough so components don't import from colors.ts too. */
  tint: typeof tint;
}

const base = {
  spacing,
  radius,
  shadows,
  fontFamily,
  fontSize,
  text: textVariants,
  gradients,
  tint,
};

export const lightTheme: Theme = { isDark: false, colors: lightColors, ...base };
export const darkTheme: Theme = { isDark: true, colors: darkColors, ...base };
