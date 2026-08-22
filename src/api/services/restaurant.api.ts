import { apiClient, query } from '../client';
import type {
  Paged,
  RestaurantTable,
  RestaurantOrder,
  RestaurantSalesReport,
  CreateRestaurantOrderPayload,
  RestaurantOrderItemPayload,
} from '../types';

/**
 * Restaurant endpoints. Every one of these 403s for a general-account tenant,
 * so screens must only be reachable via the restaurant effective roles.
 */
export const restaurantApi = {
  listTables(includeInactive = false) {
    return apiClient.get<RestaurantTable[]>(
      `/restaurant/tables${query({ includeInactive: includeInactive ? 'true' : undefined })}`,
    );
  },

  createTable(name: string) {
    return apiClient.post<RestaurantTable>('/restaurant/tables', { name });
  },

  updateTable(id: string, body: { name?: string; isActive?: boolean }) {
    return apiClient.patch<RestaurantTable>(`/restaurant/tables/${id}`, body);
  },

  deleteTable(id: string) {
    return apiClient.delete<{ message: string }>(`/restaurant/tables/${id}`);
  },

  listOrders(params: { orderStatus?: string; orderType?: string; tableId?: string } = {}) {
    return apiClient.get<RestaurantOrder[]>(`/restaurant/orders${query(params)}`);
  },

  /**
   * Paged listing for the order-history screen. `withCount` switches the
   * endpoint to the `{ items, total }` envelope; the live kitchen and cashier
   * views deliberately keep using listOrders() and receive the complete set.
   */
  listOrdersPaged(
    params: { orderStatus?: string; orderType?: string; tableId?: string } = {},
    paging: { skip: number; take: number },
  ) {
    return apiClient.get<Paged<RestaurantOrder>>(
      `/restaurant/orders${query({ ...params, withCount: 'true', skip: paging.skip, take: paging.take })}`,
    );
  },

  getOrder(id: string) {
    return apiClient.get<RestaurantOrder>(`/restaurant/orders/${id}`);
  },

  createOrder(payload: CreateRestaurantOrderPayload) {
    return apiClient.post<RestaurantOrder>('/restaurant/orders', payload);
  },

  updateDraft(
    id: string,
    body: { items: RestaurantOrderItemPayload[]; tableId?: string; version?: number },
  ) {
    return apiClient.patch<RestaurantOrder>(`/restaurant/orders/${id}/draft`, body);
  },

  /** Sends a draft to the kitchen. Rejects with 409 if the table was taken. */
  punch(id: string, tableId?: string) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/punch`, { tableId });
  },

  /** Appends a round; the kitchen ticket contains only the new lines. */
  addItems(id: string, items: RestaurantOrderItemPayload[]) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/items`, { items });
  },

  setStatus(id: string, orderStatus: 'preparing' | 'completed') {
    return apiClient.patch<RestaurantOrder>(`/restaurant/orders/${id}/status`, { orderStatus });
  },

  settle(
    id: string,
    body: { discountType?: 'amount' | 'percent'; discountValue?: number; paymentMethod?: string },
  ) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/settle`, body);
  },

  cancel(id: string) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/cancel`, {});
  },

  salesReport(from?: string, to?: string) {
    return apiClient.get<RestaurantSalesReport>(`/restaurant/reports/sales${query({ from, to })}`);
  },
};
