import { apiClient, query } from '../client';
import { Customer, CustomerPayload, Order } from '../types';

export const customersApi = {
  /**
   * NOTE: the backend CustomersController has no store scoping, so this returns
   * customers across every store. Screens filter client-side until that is
   * fixed server-side.
   */
  list(skip = 0, take = 1000) {
    return apiClient.get<Customer[]>(`/customers${query({ skip, take })}`);
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
