/**
 * Which lines the kitchen cooks. Mirrors Backend/src/common/kitchen-routing.ts.
 *
 * The SERVER decides for real and stamps `skipKitchen` on every order line;
 * this copy exists so the order screens can hint before sending ("Place order"
 * rather than "Send to kitchen" when nothing needs cooking) and so the kitchen
 * screen has one place to filter what it shows and prints.
 */
const DRINKS_CATEGORY_PATTERN = /\b(drinks?|beverages?)\b/i;

export function categorySkipsKitchen(
  category: { name?: string | null; skipKitchen?: boolean | null } | null | undefined,
): boolean {
  if (!category) return false;
  if (category.skipKitchen) return true;
  return DRINKS_CATEGORY_PATTERN.test(category.name ?? '');
}

/** The lines of an order the kitchen has to cook. */
export function kitchenLines<T extends { skipKitchen?: boolean | null }>(
  lines: T[] | null | undefined,
): T[] {
  return (lines ?? []).filter((line) => !line.skipKitchen);
}
