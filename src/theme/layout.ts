import { Platform, ViewStyle } from 'react-native';

/**
 * Spacing scale. The web app's rhythm is `space-y-6` (24) between page
 * sections, `p-5` (20) inside panels and `p-4` (16) in table cells / compact
 * cards, with `gap-3` (12) in the POS product grid.
 */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

/**
 * Radius scale. Runs larger than the web's 12px base on purpose — mobile
 * surfaces read as modern at 16–24px where the same values feel oversized on
 * desktop. Cards sit at `lg`, sheets and dialogs at `2xl`.
 */
export const radius = {
  none: 0,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

/**
 * The web `--shadow-sm/md/lg` variables are declared but unused; components use
 * Tailwind's stock shadows. These are the RN equivalents, combining iOS shadow
 * props with Android elevation.
 */
export const shadows = {
  none: {} as ViewStyle,
  // Deliberately soft and diffuse — a low-opacity shadow with a large radius
  // reads as depth; a tight dark one reads as a 2010 drop shadow.
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
  })!,
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.09,
      shadowRadius: 16,
    },
    android: { elevation: 5 },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.09,
      shadowRadius: 16,
    },
  })!,
  lg: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.14,
      shadowRadius: 28,
    },
    android: { elevation: 10 },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.14,
      shadowRadius: 28,
    },
  })!,
  /** Primary-tinted glow for the hero card, checkout bar and gradient CTAs. */
  glow: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#10B77F',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
    },
    android: { elevation: 8 },
    default: {
      shadowColor: '#10B77F',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
    },
  })!,
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
export type Shadow = keyof typeof shadows;
