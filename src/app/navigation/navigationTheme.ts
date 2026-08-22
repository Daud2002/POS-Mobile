import { DarkTheme, DefaultTheme, Theme as NavTheme } from '@react-navigation/native';

import { Theme } from '@/theme/theme';

/**
 * Maps our design tokens onto React Navigation's theme so headers, card
 * backgrounds and the screen transition backdrop match the app instead of
 * flashing the library's defaults.
 */
export function toNavigationTheme(theme: Theme): NavTheme {
  const base = theme.isDark ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: theme.isDark,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.foreground,
      border: theme.colors.border,
      notification: theme.colors.destructive,
    },
    fonts: {
      ...base.fonts,
      regular: { fontFamily: theme.fontFamily.body, fontWeight: '400' },
      medium: { fontFamily: theme.fontFamily.bodyMedium, fontWeight: '500' },
      bold: { fontFamily: theme.fontFamily.headingBold, fontWeight: '700' },
      heavy: { fontFamily: theme.fontFamily.headingBold, fontWeight: '700' },
    },
  };
}
