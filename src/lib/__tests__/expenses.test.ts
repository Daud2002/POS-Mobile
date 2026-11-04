import { expenseCategoryLabel } from '../expenses';

describe('expenseCategoryLabel', () => {
  const petrol = { id: 'c1', name: 'Petrol' } as any;

  it('reads "Category › Subcategory" when both are set', () => {
    expect(expenseCategoryLabel({ category: petrol, subcategory: { name: 'Ahmad' } as any })).toBe('Petrol › Ahmad');
  });

  it('is just the category without a subcategory', () => {
    expect(expenseCategoryLabel({ category: petrol, subcategory: null })).toBe('Petrol');
  });

  it('falls back to Uncategorized', () => {
    expect(expenseCategoryLabel({ category: null, subcategory: null })).toBe('Uncategorized');
  });
});
