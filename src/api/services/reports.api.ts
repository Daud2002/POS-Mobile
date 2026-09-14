import { apiClient, query } from '../client';
import { ProfitReport } from '../types';

export const reportsApi = {
  /**
   * Gross and net profit over the standard windows, for either account type.
   * `tz` is the device's zone, so "today" is the user's calendar day.
   */
  profit(tz: string) {
    return apiClient.get<ProfitReport>(`/reports/profit${query({ tz })}`);
  },
};
