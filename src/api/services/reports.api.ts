import { apiClient, query } from '../client';
import { ItemSalesGrouping, ItemSalesReport, ProfitReport } from '../types';

export const reportsApi = {
  /**
   * Gross and net profit over the standard windows, for either account type.
   * `tz` is the device's zone, so "today" is the user's calendar day.
   */
  profit(tz: string) {
    return apiClient.get<ProfitReport>(`/reports/profit${query({ tz })}`);
  },

  /**
   * Quantity and sales per menu item over [from, to), optionally split per
   * day or month in `tz`. `category` is a category NAME (lines carry a name
   * snapshot). Sales are line totals, before order-level discounts.
   */
  itemSales(params: {
    from?: string;
    to?: string;
    tz?: string;
    groupBy?: ItemSalesGrouping;
    category?: string;
  }) {
    return apiClient.get<ItemSalesReport>(`/reports/item-sales${query(params)}`);
  },
};
