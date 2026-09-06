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

  /**
   * For a cashier the server omits bills another cashier has printed — a
   * printed bill belongs to the till that printed it.
   */
  listOrders(
    params: { orderStatus?: string; orderType?: string; tableId?: string; billPrinted?: 'true' | 'false' } = {},
  ) {
    return apiClient.get<RestaurantOrder[]>(`/restaurant/orders${query(params)}`);
  },

  /**
   * Paged listing for the order-history screen. `withCount` switches the
   * endpoint to the `{ items, total }` envelope; the live kitchen and cashier
   * views deliberately keep using listOrders() and receive the complete set.
   */
  listOrdersPaged(
    params: {
      orderStatus?: string;
      orderType?: string;
      tableId?: string;
      search?: string;
      billPrinted?: 'true' | 'false';
    } = {},
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

  /** Bins a draft. Only a draft: anything sent to the kitchen is cancelled by the cashier. */
  discardDraft(id: string) {
    return apiClient.delete<{ id: string; discarded: boolean }>(`/restaurant/orders/${id}/draft`);
  },

  /** Sends a draft to the kitchen. Rejects with 409 if the table was taken. */
  punch(id: string, tableId?: string) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/punch`, { tableId });
  },

  /** Appends a round; the kitchen ticket contains only the new lines. */
  addItems(id: string, items: RestaurantOrderItemPayload[]) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/items`, { items });
  },

  /**
   * The kitchen's two moves. 'completed' is deliberately not offered: it means
   * paid and table freed, which only settling may do.
   */
  setStatus(id: string, orderStatus: 'preparing' | 'handed_over') {
    return apiClient.patch<RestaurantOrder>(`/restaurant/orders/${id}/status`, { orderStatus });
  },

  /**
   * Step one of taking payment. Fixes the discount, records the rider on a
   * delivery, and claims the order for this cashier. Calling it again is a
   * reprint — and the only way to change the discount.
   */
  printBill(
    id: string,
    body: { discountType?: 'amount' | 'percent'; discountValue?: number; riderName?: string },
  ) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/print-bill`, body);
  },

  /**
   * Step two: the money. Charges exactly what was printed, so only how it was
   * paid is decided here. A 'partial' payment carries the per-method amounts,
   * which must add up to the total.
   */
  settle(
    id: string,
    body: { paymentMethod?: string; split?: { cash?: number; card?: number; online?: number } },
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
