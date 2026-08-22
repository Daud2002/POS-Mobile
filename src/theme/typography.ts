import { TextStyle } from 'react-native';

/**
 * Space Grotesk for headings, DM Sans for body — matching the web app, which
 * loads both via an @import in index.css and applies Space Grotesk to h1..h6.
 *
 * Font family keys must match the names registered with expo-font in
 * src/app/providers/FontProvider.tsx.
 */
export const fontFamily = {
  heading: 'SpaceGrotesk_600SemiBold',
  headingBold: 'SpaceGrotesk_700Bold',
  headingMedium: 'SpaceGrotesk_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemibold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
  /** Receipt preview must be monospace so column alignment is truthful. */
  mono: 'Courier',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

/**
 * Named text styles. Screens should compose these rather than declaring raw
 * fontSize/fontFamily pairs, so the type scale stays consistent.
 */
export const textVariants = {
  displayLarge: {
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
  },
  display: {
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize['2xl'],
    lineHeight: 32,
  },
  h1: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, lineHeight: 28 },
  h2: { fontFamily: fontFamily.heading, fontSize: fontSize.lg, lineHeight: 26 },
  h3: { fontFamily: fontFamily.heading, fontSize: fontSize.md, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontSize: fontSize.base, lineHeight: 22 },
  bodyMedium: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  bodySemibold: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  small: { fontFamily: fontFamily.body, fontSize: fontSize.sm, lineHeight: 18 },
  smallMedium: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  caption: { fontFamily: fontFamily.body, fontSize: fontSize.xs, lineHeight: 16 },
  /** Table headers on web: `text-xs uppercase tracking-wider`. */
  overline: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Money values are `font-semibold` throughout the web app. */
  money: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  mono: { fontFamily: fontFamily.mono, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
