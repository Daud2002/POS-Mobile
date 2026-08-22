import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { queryKeys } from '@/api/queryKeys';
import { categoriesApi, productsApi, storesApi } from '@/api/services';
import { Product } from '@/api/types';
import { useStoreId } from '@/hooks/useStoreId';
import { useDebouncedValue } from '@/hooks/useDebouncedCallback';

export const ALL_CATEGORIES = 'all';

/**
 * Products, categories and store details for the POS, plus search and category
 * filtering.
 *
 * The web version fires all three requests in one `Promise.all` on mount and
 * keeps nothing; using React Query means returning to the POS tab is instant
 * and stock levels refresh in the background after a sale.
 */
export function usePosCatalog() {
  const storeId = useStoreId();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES);
  const debouncedSearch = useDebouncedValue(search, 200);

  const productsQuery = useQuery({
    queryKey: queryKeys.activeProducts(storeId ?? ''),
    queryFn: () => productsApi.listActive(storeId!, 0, 1000),
    enabled: !!storeId,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(storeId ?? ''),
    queryFn: () => categoriesApi.list(storeId!, 0, 1000),
    enabled: !!storeId,
  });

  const storeQuery = useQuery({
    queryKey: queryKeys.store(storeId ?? ''),
    queryFn: () => storesApi.getById(storeId!),
    enabled: !!storeId,
    // Store name/address/phone feed the receipt header and rarely change.
    staleTime: 10 * 60_000,
  });

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    return products.filter((product) => {
      if (categoryId !== ALL_CATEGORIES && product.categoryId !== categoryId) return false;
      if (!term) return true;

      return (
        product.name.toLowerCase().includes(term) ||
        product.sku?.toLowerCase().includes(term) ||
        product.barcode?.toLowerCase().includes(term)
      );
    });
  }, [products, categoryId, debouncedSearch]);

  const categoryOptions = useMemo(
    () => [
      { value: ALL_CATEGORIES, label: 'All' },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories],
  );

  /** Barcode lookup for the scanner. Matches the web app's exact-match rule. */
  const findByBarcode = (barcode: string): Product | undefined =>
    products.find((product) => product.barcode?.toString() === barcode);

  return {
    storeId,
    store: storeQuery.data ?? null,
    products,
    filtered,
    categoryOptions,
    categoryId,
    setCategoryId,
    search,
    setSearch,
    findByBarcode,
    loading: productsQuery.isLoading || categoriesQuery.isLoading,
    refetching: productsQuery.isRefetching,
    refetch: productsQuery.refetch,
    error: productsQuery.error ?? categoriesQuery.error,
  };
}
