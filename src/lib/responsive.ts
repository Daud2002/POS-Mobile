/**
 * Phone or tablet — decided by how wide the WINDOW is, never by the device.
 *
 * Width is what a layout actually has to work with: an iPad in Split View is
 * as narrow as a phone and should look like one, and a tablet turned on its
 * side is a different shape from the same tablet upright. Everything here is
 * pure so the rules can be tested without a screen; `useLayout()` feeds it the
 * live window size.
 *
 * `compact` is every phone held upright, and the app there is exactly as it
 * was before tablets were considered — nothing below changes a compact layout.
 */
export type SizeClass = 'compact' | 'medium' | 'expanded';

/** The window widths (in points) where the layout changes. */
export const BREAKPOINTS = {
  /** Small tablets, and large ones held upright. */
  medium: 600,
  /** Large tablets on their side. */
  expanded: 960,
} as const;

export function sizeClassOf(width: number): SizeClass {
  if (width >= BREAKPOINTS.expanded) return 'expanded';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'compact';
}

/**
 * How wide a screen's content column may grow on a tablet before it stops and
 * centres. A line of text or a list row stretched across 1,100 points is
 * harder to read than one held to a column.
 *
 * - `form`  a single form or a short detail
 * - `list`  rows read top to bottom — the default
 * - `page`  dashboards, where cards sit side by side
 * - `full`  work screens that use every point: the till, the kitchen board
 */
export const CONTENT_WIDTH = { form: 560, list: 760, page: 1120 } as const;

export type ContentWidth = keyof typeof CONTENT_WIDTH | 'full';

/**
 * How many equal columns of at least `minItemWidth` fit across `available`,
 * with `gap` between them. Always at least one, so a narrow space still
 * shows its content.
 */
export function columnsFor(available: number, minItemWidth: number, gap = 0, maxColumns = 8): number {
  if (!(available > 0) || !(minItemWidth > 0)) return 1;
  const fit = Math.floor((available + gap) / (minItemWidth + gap));
  return Math.max(1, Math.min(fit, maxColumns));
}

/** The width of each of `columns` equal columns across `available`. Rounded down so a row never wraps early. */
export function itemWidthFor(available: number, columns: number, gap = 0): number {
  const count = Math.max(1, Math.floor(columns));
  return Math.max(0, Math.floor((available - gap * (count - 1)) / count));
}

/** How wide a tablet dialog is: its preferred width, or the window less a margin when that is smaller. */
export function dialogWidthFor(windowWidth: number, preferred: number, margin = 24): number {
  return Math.max(0, Math.min(preferred, windowWidth - margin * 2));
}
