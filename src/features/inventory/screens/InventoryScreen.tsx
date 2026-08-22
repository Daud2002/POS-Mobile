import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Minus, Plus, Warehouse } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { productsApi } from '@/api/services';
import { Product } from '@/api/types';
import { PageFade } from '@/components/layout/PageFade';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SearchInput } from '@/components/ui/SearchInput';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/constants/config';
import { DEFAULT_PRODUCT_EMOJI } from '@/constants/emojis';
import { useDebouncedAction, useDebouncedValue } from '@/hooks/useDebouncedCallback';
import { useStoreId } from '@/hooks/useStoreId';
import { useTheme } from '@/theme/ThemeProvider';

function lowStockThreshold(product: Product): number {
  return product.lowStockAlertQuantity ?? DEFAULT_LOW_STOCK_THRESHOLD;
}

/**
 * Stock levels and adjustments.
 *
 * Stock edits are applied optimistically and the PATCH is debounced, so tapping
 * "+" five times sends one request. The web version fires a PATCH on every
 * keystroke and reloads the entire product list after each one.
 */
export function InventoryScreen() {
  const theme = useTheme();
  const toast = useToast();
  const storeId = useStoreId();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);

  const queryKey = queryKeys.products(storeId ?? '');

  const query = useQuery({
    queryKey,
    queryFn: () => productsApi.list(storeId!, 0, 1000),
    enabled: !!storeId,
  });

  const persistStock = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) =>
      productsApi.setStock(id, stock),
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not update stock.',
      );
      // The optimistic value is now wrong — pull the truth back from the server.
      void query.refetch();
    },
    onSuccess: () => {
      if (storeId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.activeProducts(storeId) });
      }
    },
  });

  const debouncedPersist = useDebouncedAction<number>(
    (id, stock) => persistStock.mutate({ id, stock }),
    600,
  );

  const adjustStock = useCallback(
    (product: Product, delta: number) => {
      const next = Math.max(0, product.stock + delta);
      if (next === product.stock) return;

      // Optimistic cache write so the number moves the moment it's tapped.
      queryClient.setQueryData<Product[]>(queryKey, (current) =>
        current?.map((item) => (item.id === product.id ? { ...item, stock: next } : item)),
      );

      debouncedPersist(product.id, next);
    },
    [queryClient, queryKey, debouncedPersist],
  );

  const products = useMemo(() => {
    const all = query.data ?? [];
    const term = debouncedSearch.trim().toLowerCase();

    const filtered = term
      ? all.filter((product) => product.name.toLowerCase().includes(term))
      : all;

    // Lowest stock first — the items that need attention.
    return [...filtered].sort((a, b) => a.stock - b.stock);
  }, [query.data, debouncedSearch]);

  const lowStockCount = useMemo(
    () =>
      (query.data ?? []).filter(
        (product) => product.isActive && product.stock < lowStockThreshold(product),
      ).length,
    [query.data],
  );

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <PageFade>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <SectionHeader title="Inventory" subtitle="Adjust stock levels" />
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products…"
        />

        {lowStockCount > 0 ? (
          <Card
            padding="lg"
            style={{
              backgroundColor: theme.tint(theme.colors.warning, 0.08),
              borderColor: theme.tint(theme.colors.warning, 0.3),
            }}
          >
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <AlertTriangle size={18} color={theme.colors.warning} />
              <Text variant="small" style={{ flex: 1 }}>
                <Text variant="bodySemibold" color="warning">
                  {lowStockCount}
                </Text>{' '}
                product{lowStockCount === 1 ? '' : 's'} below the low-stock threshold.
              </Text>
            </View>
          </Card>
        ) : null}
      </View>

      {query.isLoading ? (
        <View style={{ padding: theme.spacing.lg }}>
          <SkeletonList count={6} lines={1} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(product) => product.id}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={query.refetch}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={search ? 'No matching products' : 'Nothing in inventory'}
              description={
                search ? 'Try a different search term.' : 'Add products to track stock.'
              }
              icon={<Warehouse size={28} color={theme.colors.mutedForeground} />}
            />
          }
          renderItem={({ item }) => {
            const isLow = item.stock < lowStockThreshold(item);

            return (
              <Card
                padding="lg"
                style={
                  isLow && item.isActive
                    ? { backgroundColor: theme.tint(theme.colors.warning, 0.05) }
                    : undefined
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                  }}
                >
                  <Text style={{ fontSize: 24, lineHeight: 30 }}>
                    {item.image || DEFAULT_PRODUCT_EMOJI}
                  </Text>

                  <View style={{ flex: 1 }}>
                    <Text variant="smallMedium" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" color="mutedForeground">
                      {item.category?.name ?? 'Uncategorized'}
                      {item.isActive ? '' : ' · Disabled'}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <IconButton
                      accessibilityLabel={`Decrease stock of ${item.name}`}
                      onPress={() => adjustStock(item, -1)}
                      disabled={item.stock <= 0}
                      size={32}
                    >
                      <Minus size={15} color={theme.colors.foreground} />
                    </IconButton>

                    <Text
                      variant="bodySemibold"
                      color={isLow ? 'warning' : 'foreground'}
                      style={{ minWidth: 34, textAlign: 'center' }}
                    >
                      {item.stock}
                    </Text>

                    <IconButton
                      accessibilityLabel={`Increase stock of ${item.name}`}
                      onPress={() => adjustStock(item, 1)}
                      size={32}
                    >
                      <Plus size={15} color={theme.colors.foreground} />
                    </IconButton>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
      </PageFade>
    </SafeAreaView>
  );
}
