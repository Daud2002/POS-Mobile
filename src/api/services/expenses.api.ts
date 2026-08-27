import { apiClient, query } from '../client';
import {
  Expense,
  ExpenseCategory,
  ExpenseCategoryPayload,
  ExpensePayload,
  ExpenseSummary,
} from '../types';

/**
 * The store's spend ledger.
 *
 * Store-scoped, so everyone holding the `expenses` module reads and writes the
 * same book. Categories are owner-only and answer 403 for staff — callers
 * should hide the management UI rather than rely on the error.
 */
export const expensesApi = {
  list(filters: { from?: string; to?: string; categoryId?: string; search?: string } = {}, skip = 0, take = 200) {
    return apiClient.get<Expense[]>(`/expenses${query({ ...filters, skip, take })}`);
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
};
