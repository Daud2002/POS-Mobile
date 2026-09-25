import { apiClient, query } from '../client';
import {
  AdjustStockPayload,
  InventoryItem,
  InventoryItemPayload,
  InventoryItemUpdatePayload,
  InventoryMovement,
  Paged,
  RecipeIngredient,
  RecipeLine,
  StockInPayload,
} from '../types';

/**
 * Restaurant ingredient stock and the recipes that consume it. Every route is
 * restaurant-only; the store is taken from the JWT server-side.
 */
export const inventoryApi = {
  /** Unpaged — feeds the recipe picker, which must offer every ingredient. */
  list(params: { search?: string; includeInactive?: boolean } = {}) {
    return apiClient.get<InventoryItem[]>(
      `/inventory${query({
        search: params.search || undefined,
        includeInactive: params.includeInactive ? 'true' : undefined,
      })}`,
    );
  },

  listPaged(params: { search?: string; includeInactive?: boolean; skip?: number; take?: number }) {
    return apiClient.get<Paged<InventoryItem>>(
      `/inventory${query({
        search: params.search || undefined,
        includeInactive: params.includeInactive ? 'true' : undefined,
        withCount: 'true',
        skip: params.skip ?? 0,
        take: params.take ?? 100,
      })}`,
    );
  },

  getById(id: string) {
    return apiClient.get<InventoryItem>(`/inventory/${id}`);
  },

  movements(id: string, skip = 0, take = 50) {
    return apiClient.get<Paged<InventoryMovement>>(
      `/inventory/${id}/movements${query({ skip, take })}`,
    );
  },

  create(payload: InventoryItemPayload) {
    return apiClient.post<InventoryItem>('/inventory', payload);
  },

  update(id: string, payload: InventoryItemUpdatePayload) {
    return apiClient.patch<InventoryItem>(`/inventory/${id}`, payload);
  },

  stockIn(id: string, payload: StockInPayload) {
    return apiClient.post<InventoryItem>(`/inventory/${id}/stock-in`, payload);
  },

  adjust(id: string, payload: AdjustStockPayload) {
    return apiClient.post<InventoryItem>(`/inventory/${id}/adjust`, payload);
  },

  /** 409 while a recipe still names the item — surface the server's message. */
  remove(id: string) {
    return apiClient.delete<{ id: string; deleted: boolean }>(`/inventory/${id}`);
  },

  getRecipe(productId: string) {
    return apiClient.get<RecipeIngredient[]>(`/inventory/recipes/${productId}`);
  },

  setRecipe(productId: string, ingredients: RecipeLine[]) {
    return apiClient.put<RecipeIngredient[]>(`/inventory/recipes/${productId}`, { ingredients });
  },
};
