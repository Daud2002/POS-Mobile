import { apiClient } from '../client';
import { Store } from '../types';

export const storesApi = {
  /** Supplies the receipt header: store name, address and phone. */
  getById(id: string) {
    return apiClient.get<Store>(`/stores/${id}`);
  },
};
