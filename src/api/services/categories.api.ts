import { apiClient, query } from '../client';
import { Category, CategoryPayload } from '../types';

export const categoriesApi = {
  list(storeId: string, skip = 0, take = 1000) {
    return apiClient.get<Category[]>(`/categories${query({ storeId, skip, take })}`);
  },

  getById(id: string) {
    return apiClient.get<Category>(`/categories/${id}`);
  },

  /**
   * The web app omits `storeId` here even though the screen guards on it being
   * present — mobile always sends it.
   */
  create(payload: CategoryPayload) {
    return apiClient.post<Category>('/categories', payload);
  },

  update(id: string, payload: Partial<CategoryPayload>) {
    return apiClient.patch<Category>(`/categories/${id}`, payload);
  },

  remove(id: string) {
    return apiClient.delete<void>(`/categories/${id}`);
  },
};
