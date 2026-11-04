import { apiClient, query } from '../client';
import {
  Expense,
  ExpenseBreakdownCategory,
  ExpenseCategory,
  ExpenseCategoryPayload,
  ExpensePayload,
  ExpenseSubcategory,
  ExpenseSummary,
} from '../types';

/** `categoryId` / `subcategoryId` take an id, or the literal 'none' for the empty bucket. */
export type ExpenseFilters = {
  from?: string;
  to?: string;
  categoryId?: string;
  subcategoryId?: string;
  search?: string;
};

/**
 * The store's spend ledger.
 *
 * Store-scoped, so everyone holding the `expenses` module reads and writes the
 * same book. Categories are owner/supervisor-only and answer 403 for staff —
 * callers should hide the management UI rather than rely on the error.
 * Subcategories can be ADDED by anyone with the module; renaming, retiring and
 * deleting them follows the category rule.
 */
export const expensesApi = {
  list(filters: ExpenseFilters = {}, skip = 0, take = 200) {
    return apiClient.get<Expense[]>(`/expenses${query({ ...filters, skip, take })}`);
  },

  /** Spend per category and subcategory over the same filters as list(). */
  breakdown(filters: ExpenseFilters = {}) {
    return apiClient.get<ExpenseBreakdownCategory[]>(`/expenses/breakdown${query(filters)}`);
  },

  getById(id: string) {
    return apiClient.get<Expense>(`/expenses/${id}`);
  },

  create(payload: ExpensePayload) {
    return apiClient.post<Expense>('/expenses', payload);
  },

  update(id: string, payload: Partial<ExpensePayload>) {
    return apiClient.patch<Expense>(`/expenses/${id}`, payload);
  },

  remove(id: string) {
    return apiClient.delete<void>(`/expenses/${id}`);
  },

  /**
   * Today's and this month's spend.
   *
   * `date` is the DEVICE's local day, so "today" is the user's calendar day
   * rather than the API server's timezone.
   */
  summary(date?: string) {
    return apiClient.get<ExpenseSummary>(`/expenses/summary${query({ date })}`);
  },

  listCategories(includeInactive = false) {
    return apiClient.get<ExpenseCategory[]>(
      `/expenses/categories${includeInactive ? '?includeInactive=true' : ''}`,
    );
  },

  createCategory(payload: ExpenseCategoryPayload) {
    return apiClient.post<ExpenseCategory>('/expenses/categories', payload);
  },

  updateCategory(id: string, payload: Partial<ExpenseCategoryPayload>) {
    return apiClient.patch<ExpenseCategory>(`/expenses/categories/${id}`, payload);
  },

  removeCategory(id: string) {
    return apiClient.delete<void>(`/expenses/categories/${id}`);
  },

  /** Returns the existing one when the name is already used under the category. */
  createSubcategory(categoryId: string, name: string) {
    return apiClient.post<ExpenseSubcategory>('/expenses/subcategories', { categoryId, name });
  },

  updateSubcategory(id: string, payload: { name?: string; isActive?: boolean }) {
    return apiClient.patch<ExpenseSubcategory>(`/expenses/subcategories/${id}`, payload);
  },

  removeSubcategory(id: string) {
    return apiClient.delete<void>(`/expenses/subcategories/${id}`);
  },
};
