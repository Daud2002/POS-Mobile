/**
 * Icons for products and categories.
 *
 * The `image` field on both holds an EMOJI, not a URL. A character costs
 * nothing to fetch, which matters on a phone working off shop wifi, and it
 * lets an owner pick one without an upload flow standing in the way.
 *
 * Kept in step with the web app's `src/lib/menuIcons.ts` — the same store is
 * edited from both, so the two shelves have to hold the same icons.
 */

export interface IconGroup {
  label: string;
  icons: string[];
}

export const ICON_GROUPS: IconGroup[] = [
  {
    label: 'Mains',
    icons: ['🍔', '🍕', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🍝', '🍜', '🍲', '🍛'],
  },
  {
    label: 'Grill & seafood',
    icons: ['🍗', '🍖', '🥩', '🍢', '🍤', '🐟', '🦐', '🥓', '🍳', '🥚', '🧆', '🫓'],
  },
  {
    label: 'Sides & breads',
    icons: ['🥗', '🍚', '🍱', '🥘', '🍞', '🥐', '🥖', '🧀', '🥔', '🌽', '🥕', '🥒'],
  },
  {
    label: 'Sweets',
    icons: ['🍰', '🧁', '🍩', '🍪', '🍫', '🍬', '🍮', '🍨', '🍦', '🥧', '🍯', '🍡'],
  },
  {
    label: 'Drinks',
    icons: ['☕', '🍵', '🥤', '🧋', '🧃', '🥛', '🧉', '🍺', '🍷', '🍹', '🧊', '🍾'],
  },
  {
    label: 'Fruit & retail',
    icons: ['🍎', '🍌', '🍇', '🍓', '🍉', '🥭', '🍍', '🥥', '📦', '🛍️', '🧴', '🧼'],
  },
];

/** Flat list — the shelf a picker without groups draws from. */
export const PRODUCT_EMOJIS = ICON_GROUPS.flatMap((group) => group.icons);

/** What the general store has always stamped on a product with no icon. */
export const DEFAULT_PRODUCT_EMOJI = '📦';

/** The restaurant equivalent — a parcel is the wrong idea for a dish. */
export const DEFAULT_MENU_ICON = '🍽️';

export const DEFAULT_CATEGORY_ICON = '🏷️';

interface HasIcon {
  image?: string | null;
}

/**
 * A dish falls back to its category's icon.
 *
 * Menus are already grouped by the thing the icon would say — everything in
 * "Cold Drinks" is a cold drink — so an owner who sets icons on the eight
 * categories alone gets a menu that reads at a glance without touching two
 * hundred dishes.
 */
export function iconFor(
  product?: HasIcon | null,
  category?: HasIcon | null,
  fallback: string = DEFAULT_MENU_ICON,
): string {
  return product?.image?.trim() || category?.image?.trim() || fallback;
}

export function categoryIcon(
  category?: HasIcon | null,
  fallback: string = DEFAULT_CATEGORY_ICON,
): string {
  return category?.image?.trim() || fallback;
}
