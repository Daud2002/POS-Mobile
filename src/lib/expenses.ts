import type { Expense } from '@/api/types';

/** "Petrol › Ahmad", "Petrol", or "Uncategorized" — how an expense's filing reads in a list. */
export function expenseCategoryLabel(expense: Pick<Expense, 'category' | 'subcategory'>): string {
  const category = expense.category?.name ?? 'Uncategorized';
  return expense.subcategory?.name ? `${category} › ${expense.subcategory.name}` : category;
}
