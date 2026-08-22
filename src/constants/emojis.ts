/**
 * The product "image" field holds an emoji, not a URL. These are the exact 16
 * options offered by the web Products form.
 */
export const PRODUCT_EMOJIS = [
  '📦',
  '☕',
  '🍔',
  '🍕',
  '🍟',
  '🥗',
  '🍰',
  '🍦',
  '🥤',
  '🌭',
  '🍗',
  '🍮',
  '🥛',
  '🧁',
  '🥐',
  '🍩',
] as const;

export const DEFAULT_PRODUCT_EMOJI = '📦';
