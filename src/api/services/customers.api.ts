import { apiClient, query } from '../client';
import { Customer, CustomerPayload, CustomerSuggestion, Order } from '../types';

export const customersApi = {
  /** The store's own customers — the server scopes by the caller's tenant. */
  list(skip = 0, take = 1000) {
    return apiClient.get<Customer[]>(`/customers${query({ skip, take })}`);
  },

  /**
   * Live matches on name, phone or address for the order screen. Two
   * characters minimum — the server returns nothing for less.
   */
  suggest(q: string, limit = 8) {
    return apiClient.get<CustomerSuggestion[]>(`/customers/suggest${query({ q, limit })}`);
  },

  getById(id: string) {
    return apiClient.get<Customer>(`/customers/${id}`);
  },

  getWithOrders(id: string) {
    return apiClient.get<{ customer: Customer; orders: Order[] }>(
      `/customers/${id}/with-orders`,
    );
  },

  create(payload: CustomerPayload) {
    return apiClient.post<Customer>('/customers', payload);
  },

  update(id: string, payload: Partial<CustomerPayload>) {
    return apiClient.patch<Customer>(`/customers/${id}`, payload);
  },

  remove(id: string) {
    return apiClient.delete<void>(`/customers/${id}`);
  },
};
