import { apiClient, query } from '../client';
import type {
  Paged,
  RestaurantTable,
  RestaurantOrder,
  RestaurantSalesReport,
  CreateRestaurantOrderPayload,
  RestaurantOrderItemPayload,
  RemoveOrderItemPayload,
  OrderHistory,
  CreditBook,
  CreditCustomerChoice,
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

  /** Every role sees every order its filters ask for, whichever till printed it. */
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

  /**
   * Appends a round; the kitchen ticket contains only the new lines.
   * `sendToKitchen: false` is the till's "Print bill & update": the lines are
   * billed but never reach the kitchen. The server ignores it for waiters.
   */
  addItems(id: string, items: RestaurantOrderItemPayload[], options: { sendToKitchen?: boolean } = {}) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/items`, { items, ...options });
  },

  /**
   * Strikes lines (or part of a line) off a live order — a waiter at the
   * table or any till. The kitchen gets a cancellation ticket for anything it
   * had not yet handed over (unless the till sends `sendToKitchen: false`);
   * the bill wants reprinting, and a waiter's removal clears its "printed" mark.
   */
  removeItems(id: string, items: RemoveOrderItemPayload[], options: { sendToKitchen?: boolean } = {}) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/items/remove`, { items, ...options });
  },

  /** The order's audit trail: original lines, every change, every print. */
  history(id: string) {
    return apiClient.get<OrderHistory>(`/restaurant/orders/${id}/history`);
  },

  /**
   * The kitchen's two moves. 'completed' is deliberately not offered: it means
   * paid and table freed, which only settling may do.
   */
  setStatus(id: string, orderStatus: 'preparing' | 'handed_over') {
    return apiClient.patch<RestaurantOrder>(`/restaurant/orders/${id}/status`, { orderStatus });
  },

  /**
   * Prints (or reprints) the bill: fixes the discount and delivery charge and
   * claims the order for this cashier. Every money field is "absent = keep
   * what is stored, null = clear it", so a bare reprint never wipes a
   * discount the order was punched with.
   */
  printBill(
    id: string,
    body: {
      discountType?: 'amount' | 'percent' | null;
      discountValue?: number | null;
      deliveryCharge?: number | null;
    },
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

  /**
   * The customer leaves without paying: the order is completed and its table
   * freed, but no money is taken. The money boxes only count when the bill
   * was not printed.
   */
  credit(
    id: string,
    body: CreditCustomerChoice & {
      discountType?: 'amount' | 'percent' | null;
      discountValue?: number | null;
      deliveryCharge?: number | null;
    },
  ) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/credit`, body);
  },

  /** A credit customer pays; the money goes on the caller's open shift. */
  settleCredit(
    id: string,
    body: { paymentMethod?: string; split?: { cash?: number; card?: number; online?: number } },
  ) {
    return apiClient.post<RestaurantOrder>(`/restaurant/orders/${id}/credit/settle`, body);
  },

  creditCustomers(params: { search?: string; status?: 'owing' | 'all' } = {}) {
    return apiClient.get<CreditBook>(
      `/restaurant/credit/customers${query({ search: params.search?.trim() || undefined, status: params.status })}`,
    );
  },

  /** One customer's credit orders: still owed first, then paid, each newest first. */
  creditCustomerOrders(customerId: string) {
    return apiClient.get<RestaurantOrder[]>(`/restaurant/credit/customers/${customerId}/orders`);
  },

  salesReport(from?: string, to?: string) {
    return apiClient.get<RestaurantSalesReport>(`/restaurant/reports/sales${query({ from, to })}`);
  },
};
