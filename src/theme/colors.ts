/**
 * Color tokens ported 1:1 from the web app's CSS custom properties
 * (Frontend/src/index.css). HSL values were converted to hex.
 *
 * The web app defines a complete dark palette but never activates it — nothing
 * ever adds the `dark` class. Mobile ships both from day one.
 */

/** Adds an alpha channel to a 6-digit hex color. `tint('#10B77F', 0.1)` -> '#10B77F1A' */
export function tint(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const suffix = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${hex}${suffix}`;
}

/**
 * Brand colors that do not change between light and dark, exactly as in the web
 * app where `--primary`, `--accent`, `--destructive`, `--success`, `--warning`
 * and `--info` are declared once and never overridden in the `.dark` block.
 */
const brand = {
  primary: '#10B77F',
  primaryForeground: '#FFFFFF',
  accent: '#6D54D4',
  accentForeground: '#FFFFFF',
  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  success: '#10B77F',
  warning: '#F59E0B',
  info: '#1E8FFF',
} as const;

/**
 * The navigation surface is dark in BOTH themes. On web the sidebar is
 * `--sidebar-background: 222 47% 11%` (#0F172A) even in light mode — it is a
 * fixed dark rail, not a theme-following surface. Keeping that preserves the
 * app's identity on mobile.
 */
const navLight = {
  navBackground: '#0F172A',
  navForeground: '#C5CAD3',
  navActive: '#10B77F',
  navActiveForeground: '#FFFFFF',
  navSurface: '#182239',
  navBorder: '#20283C',
} as const;

const navDark = {
  navBackground: '#080C17',
  navForeground: '#A8AFBD',
  navActive: '#10B77F',
  navActiveForeground: '#FFFFFF',
  navSurface: '#121A2B',
  navBorder: '#191F2E',
} as const;

/**
 * The full token set. Declared as an interface (rather than inferred from the
 * light palette) so both themes are checked against one shape and neither can
 * drift out of sync.
 */
export interface ColorTokens {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  warning: string;
  info: string;

  navBackground: string;
  navForeground: string;
  navActive: string;
  navActiveForeground: string;
  navSurface: string;
  navBorder: string;

  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  /** Scrim behind modals and bottom sheets. */
  overlay: string;
}

export const lightColors: ColorTokens = {
  ...brand,
  ...navLight,
  background: '#F6F7F9',
  foreground: '#0F172A',
  card: '#FFFFFF',
  cardForeground: '#0F172A',
  popover: '#FFFFFF',
  popoverForeground: '#0F172A',
  secondary: '#EBECF0',
  secondaryForeground: '#0F172A',
  muted: '#EBECF0',
  mutedForeground: '#6B7280',
  border: '#E5E7EB',
  input: '#E5E7EB',
  ring: '#10B77F',
  overlay: '#0F172A99',
};

export const darkColors: ColorTokens = {
  ...brand,
  ...navDark,
  background: '#080C17',
  foreground: '#EBECF0',
  card: '#0C1322',
  cardForeground: '#EBECF0',
  popover: '#0C1322',
  popoverForeground: '#EBECF0',
  secondary: '#182239',
  secondaryForeground: '#EBECF0',
  muted: '#191F2E',
  mutedForeground: '#828997',
  border: '#20283C',
  input: '#20283C',
  ring: '#10B77F',
  overlay: '#000000B3',
};

export type ColorName = keyof ColorTokens;

/**
 * Gradients from `--gradient-primary` / `--gradient-accent` / `--gradient-dark`.
 * Expressed as color stop arrays; consumers pass them to a gradient component.
 *
 * Note: the web app also references a `gradient-secondary` class that is never
 * defined anywhere, so that element renders transparent. Not reproduced here.
 */
export const gradients = {
  primary: ['#10B77F', '#17CFB0'],
  accent: ['#6D54D4', '#A347D1'],
  dark: ['#0B111E', '#131D34'],
} as const;
