import { apiClient, query } from '../client';
import type {
  CashierShift,
  CashierShiftDetail,
  CashierDashboard,
  CashierSummaryRow,
} from '../types';

/**
 * Cashier shifts — one person's window of accountability over a drawer.
 *
 * Every payment taken while a shift is open is stamped onto it, so several
 * cashiers can work the same day and each hand over exactly what they took.
 */
export const shiftsApi = {
  /** My open drawer with live totals, or null when I have none. */
  current() {
    return apiClient.get<CashierShift | null>('/shifts/current');
  },

  open(openingFloat: number) {
    return apiClient.post<CashierShift>('/shifts/open', { openingFloat });
  },

  close(id: string, body: { countedCash: number; notes?: string }) {
    return apiClient.post<CashierShiftDetail>(`/shifts/${id}/close`, body);
  },

  /** Owner closes a drawer the cashier left open; variance stays unknown. */
  forceClose(id: string, notes?: string) {
    return apiClient.post<CashierShiftDetail>(`/shifts/${id}/force-close`, { notes });
  },

  /** Owner confirms the cash physically reached them. */
  collect(id: string, body: { collectedAmount: number; notes?: string }) {
    return apiClient.post<CashierShiftDetail>(`/shifts/${id}/collect`, body);
  },

  list(filters: { status?: string; userId?: string; from?: string; to?: string } = {}) {
    return apiClient.get<CashierShift[]>(`/shifts${query(filters)}`);
  },

  mine() {
    return apiClient.get<CashierShift[]>('/shifts/mine');
  },

  /** One shift with its totals AND the orders settled during it. */
  get(id: string) {
    return apiClient.get<CashierShiftDetail>(`/shifts/${id}`);
  },

  /** What THIS cashier collected, windowed on when payment was taken. */
  myDashboard(from?: string, to?: string) {
    return apiClient.get<CashierDashboard>(`/shifts/me/dashboard${query({ from, to })}`);
  },

  /** Owner's per-cashier summary: takings, variance, still to collect. */
  summaryByCashier(from?: string, to?: string) {
    return apiClient.get<CashierSummaryRow[]>(`/shifts/summary/by-cashier${query({ from, to })}`);
  },
};
