import { apiClient, query } from '../client';
import { Product, ProductPayload } from '../types';

export const productsApi = {
  list(storeId: string, skip = 0, take = 1000) {
    return apiClient.get<Product[]>(`/products${query({ storeId, skip, take })}`);
  },

  /** Guarded endpoint used by the POS — returns only active products. */
  listActive(storeId: string, skip = 0, take = 1000) {
    return apiClient.get<Product[]>(`/products/active${query({ storeId, skip, take })}`);
  },

  getById(id: string) {
    return apiClient.get<Product>(`/products/${id}`);
  },

  /** `storeId` is injected server-side from the JWT. */
  create(payload: ProductPayload) {
    return apiClient.post<Product>('/products', payload);
  },

  update(id: string, payload: Partial<ProductPayload>) {
    return apiClient.patch<Product>(`/products/${id}`, payload);
  },

  setStock(id: string, stock: number) {
    return apiClient.patch<Product>(`/products/${id}`, { stock });
  },

  setActive(id: string, isActive: boolean) {
    return apiClient.patch<Product>(`/products/${id}`, { isActive });
  },

  remove(id: string) {
    return apiClient.delete<void>(`/products/${id}`);
  },
};
