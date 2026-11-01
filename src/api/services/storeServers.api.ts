import type { StoreServerDiscovery } from '@/lib/connection/types';

import { apiClient } from '../client';

export const storeServersApi = {
  /**
   * Cloud only: whether the signed-in user's store runs on a store server, and
   * the addresses that server reported on the shop network.
   */
  discover() {
    return apiClient.get<StoreServerDiscovery>('/store-servers/discover');
  },
};
