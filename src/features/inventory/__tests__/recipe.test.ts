import { newRecipeRow, recipeLinesFromRows, rowsFromRecipe } from '../lib/recipe';

describe('recipeLinesFromRows', () => {
  it('parses rows into lines and drops wholly blank ones', () => {
    const result = recipeLinesFromRows([
      newRecipeRow('milk', '200'),
      newRecipeRow('', ''),
      newRecipeRow('sugar', '12,5'),
    ]);
    expect(result).toEqual({
      lines: [
        { inventoryItemId: 'milk', quantity: 200 },
        { inventoryItemId: 'sugar', quantity: 12.5 },
      ],
    });
  });

  it('allows an empty recipe, which clears it', () => {
    expect(recipeLinesFromRows([])).toEqual({ lines: [] });
  });

  it('refuses half-filled rows, zero amounts and duplicates', () => {
    expect(recipeLinesFromRows([newRecipeRow('', '5')]).error).toBeDefined();
    expect(recipeLinesFromRows([newRecipeRow('milk', '')]).error).toBeDefined();
    expect(recipeLinesFromRows([newRecipeRow('milk', '0')]).error).toBeDefined();
    expect(
      recipeLinesFromRows([newRecipeRow('milk', '1'), newRecipeRow('milk', '2')]).error,
    ).toBeDefined();
  });
});

describe('rowsFromRecipe', () => {
  it('gives each line its own key', () => {
    const rows = rowsFromRecipe([
      { inventoryItemId: 'a', quantity: 1, name: 'A', unit: 'g', isActive: true },
      { inventoryItemId: 'b', quantity: 2.5, name: 'B', unit: 'ml', isActive: true },
    ]);
    expect(rows.map((row) => row.quantity)).toEqual(['1', '2.5']);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });
});
