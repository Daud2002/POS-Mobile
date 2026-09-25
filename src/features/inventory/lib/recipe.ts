import type { RecipeIngredient, RecipeLine } from '@/api/types';

import { parseAmount } from './quantity';

/** One editable row of the product form's Ingredients section. */
export interface RecipeRow {
  /** Local identity for React keys; rows have no id until saved. */
  key: string;
  inventoryItemId: string;
  /** Text as typed, parsed on save. */
  quantity: string;
}

let rowSeq = 0;

export function newRecipeRow(inventoryItemId = '', quantity = ''): RecipeRow {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, inventoryItemId, quantity };
}

export function rowsFromRecipe(recipe: RecipeIngredient[]): RecipeRow[] {
  return recipe.map((line) => newRecipeRow(line.inventoryItemId, String(line.quantity)));
}

/**
 * Turns the form's rows into the PUT body, or explains what is wrong.
 *
 * Wholly blank rows are dropped — an "Add ingredient" tapped and then
 * abandoned is not an error. A half-filled one is, and so is naming the same
 * ingredient twice, which the server would refuse anyway.
 */
export function recipeLinesFromRows(
  rows: RecipeRow[],
): { lines: RecipeLine[]; error?: undefined } | { lines?: undefined; error: string } {
  const lines: RecipeLine[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const blank = !row.inventoryItemId && !row.quantity.trim();
    if (blank) continue;
    if (!row.inventoryItemId) return { error: 'Choose an item for every ingredient row' };

    const quantity = parseAmount(row.quantity);
    if (quantity === null || quantity <= 0) {
      return { error: 'Enter how much of each ingredient one serving uses' };
    }
    if (seen.has(row.inventoryItemId)) {
      return { error: 'An ingredient appears twice — combine the rows' };
    }
    seen.add(row.inventoryItemId);
    lines.push({ inventoryItemId: row.inventoryItemId, quantity: Math.round(quantity * 1000) / 1000 });
  }

  return { lines };
}
