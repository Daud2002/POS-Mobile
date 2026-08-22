import { apiClient, query } from '../client';
import { CreateOrderPayload, InvoiceData, Order, OrderStatus, PaymentMethod } from '../types';

export const ordersApi = {
  /** The backend derives the store from the JWT and ignores a storeId param. */
  list(skip = 0, take = 1000) {
    return apiClient.get<Order[]>(`/orders${query({ skip, take })}`);
  },

  getById(id: string) {
    return apiClient.get<Order>(`/orders/${id}`);
  },

  listByCustomer(customerId: string, skip = 0, take = 1000) {
    return apiClient.get<Order[]>(`/orders/customer/${customerId}${query({ skip, take })}`);
  },

  create(payload: CreateOrderPayload) {
    return apiClient.post<Order>('/orders', payload);
  },

  updateStatus(id: string, status: OrderStatus) {
    return apiClient.patch<Order>(`/orders/${id}`, { status });
  },

  markAsPaid(id: string, paymentMethod?: PaymentMethod) {
    return apiClient.patch<Order>(`/orders/${id}/mark-as-paid`, { paymentMethod });
  },

  remove(id: string) {
    return apiClient.delete<void>(`/orders/${id}`);
  },

  /**
   * The receipt source of truth. Reprints and receipt previews build from this
   * rather than from cart state, so printed totals always match the database.
   */
  getInvoice(orderId: string) {
    return apiClient.get<InvoiceData>(`/invoices/${orderId}`);
  },
};
