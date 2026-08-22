import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { categoriesApi, productsApi } from '@/api/services';
import { Product, ProductPayload } from '@/api/types';
import { useToast } from '@/components/ui/Toast';
import { useDebouncedValue } from '@/hooks/useDebouncedCallback';
import { useStoreId } from '@/hooks/useStoreId';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Product list, search, and create/update/delete mutations. */
export function useProducts() {
  const storeId = useStoreId();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);

  const productsQuery = useQuery({
    queryKey: queryKeys.products(storeId ?? ''),
    queryFn: () => productsApi.list(storeId!, 0, 1000),
    enabled: !!storeId,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(storeId ?? ''),
    queryFn: () => categoriesApi.list(storeId!, 0, 1000),
    enabled: !!storeId,
  });

  const invalidate = () => {
    if (!storeId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.products(storeId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.activeProducts(storeId) });
  };

  const products = useMemo(() => {
    const all = productsQuery.data ?? [];
    const term = debouncedSearch.trim().toLowerCase();

    const filtered = term
      ? all.filter(
          (product) =>
            product.name.toLowerCase().includes(term) ||
            product.sku?.toLowerCase().includes(term) ||
            product.barcode?.toLowerCase().includes(term),
        )
      : all;

    // Active products first, matching the web ordering.
    return [...filtered].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }, [productsQuery.data, debouncedSearch]);

  const create = useMutation({
    mutationFn: (payload: ProductPayload) => productsApi.create(payload),
    onSuccess: () => {
      toast.success('Product created');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not create the product.')),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProductPayload> }) =>
      productsApi.update(id, payload),
    onSuccess: () => {
      toast.success('Product updated');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update the product.')),
  });

  /**
   * Active toggle, applied optimistically so the switch responds instantly
   * instead of waiting on a round-trip and a full list refetch.
   */
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      productsApi.setActive(id, isActive),
    onMutate: async ({ id, isActive }) => {
      if (!storeId) return;
      const key = queryKeys.products(storeId);
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<Product[]>(key);
      queryClient.setQueryData<Product[]>(key, (current) =>
        current?.map((product) => (product.id === id ? { ...product, isActive } : product)),
      );

      return { previous, key };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      toast.error(errorMessage(error, 'Could not update the product.'));
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      toast.success('Product deleted');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete the product.')),
  });

  return {
    products,
    categories: categoriesQuery.data ?? [],
    total: productsQuery.data?.length ?? 0,
    search,
    setSearch,
    loading: productsQuery.isLoading,
    refetching: productsQuery.isRefetching,
    refetch: productsQuery.refetch,
    create: create.mutateAsync,
    update: update.mutateAsync,
    toggleActive: toggleActive.mutate,
    remove: remove.mutateAsync,
    saving: create.isPending || update.isPending,
  };
}
