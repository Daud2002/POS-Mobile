import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { inventoryApi } from '@/api/services';
import {
  AdjustStockPayload,
  InventoryItemPayload,
  InventoryItemUpdatePayload,
  StockInPayload,
} from '@/api/types';
import { useToast } from '@/components/ui/Toast';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Restaurant ingredient stock: the list plus every mutation the screen needs.
 *
 * The whole list is fetched once, retired items included, and searched on the
 * device: a kitchen stocks tens of ingredients, not thousands, and filtering
 * locally keeps the search box instant.
 */
export function useRestaurantInventory() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const itemsQuery = useQuery({
    queryKey: queryKeys.inventory('with-inactive'),
    queryFn: () => inventoryApi.list({ includeInactive: true }),
  });

  /** Every inventory query — list, item, movements, recipes — shares the prefix. */
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }, [queryClient]);

  // A settled order deducts its recipe server-side; the push keeps this
  // screen's counts honest while it is open.
  useRealtime({ events: [RealtimeEvents.inventoryUpdated], onChange: invalidate });

  const create = useMutation({
    mutationFn: (payload: InventoryItemPayload) => inventoryApi.create(payload),
    onSuccess: () => {
      toast.success('Item added');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not add the item.')),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InventoryItemUpdatePayload }) =>
      inventoryApi.update(id, payload),
    onSuccess: () => {
      toast.success('Item updated');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update the item.')),
  });

  const stockIn = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StockInPayload }) =>
      inventoryApi.stockIn(id, payload),
    onSuccess: () => {
      toast.success('Stock recorded');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not record the stock.')),
  });

  const adjust = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdjustStockPayload }) =>
      inventoryApi.adjust(id, payload),
    onSuccess: () => {
      toast.success('Count updated');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update the count.')),
  });

  // A 409 here means a recipe still uses the item; the server's message says
  // which way out (retire, or edit the recipes), so it is shown verbatim.
  const remove = useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => {
      toast.success('Item deleted');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete the item.')),
  });

  return {
    items: itemsQuery.data ?? [],
    loading: itemsQuery.isLoading,
    refetching: itemsQuery.isRefetching,
    refetch: itemsQuery.refetch,
    create: create.mutateAsync,
    update: update.mutateAsync,
    stockIn: stockIn.mutateAsync,
    adjust: adjust.mutateAsync,
    remove: remove.mutateAsync,
    saving: create.isPending || update.isPending,
    stocking: stockIn.isPending,
    adjusting: adjust.isPending,
  };
}
