import { PackagePlus, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Product } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { PageFade } from '@/components/layout/PageFade';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Fab } from '@/components/ui/Fab';
import { IconButton } from '@/components/ui/IconButton';
import { SearchInput } from '@/components/ui/SearchInput';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/constants/config';
import { DEFAULT_PRODUCT_EMOJI, iconFor } from '@/constants/emojis';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useTheme } from '@/theme/ThemeProvider';

import { ProductFormSheet } from '../components/ProductFormSheet';
import { useProducts } from '../hooks/useProducts';

/** Product catalog: list, search, create/edit, activate and delete. */
export function ProductsScreen() {
  const theme = useTheme();
  const { format } = useStoreCurrency();
  const products = useProducts();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setFormOpen(true);
  };

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
        <SectionHeader title="Products" subtitle={`${products.total} in catalog`} />
        <SearchInput
          value={products.search}
          onChangeText={products.setSearch}
          placeholder="Search by name, SKU or barcode"
        />
      </View>

      {products.loading ? (
        <View style={{ padding: theme.spacing.lg }}>
          <SkeletonList count={6} lines={1} />
        </View>
      ) : (
        <FlatList
          data={products.products}
          keyExtractor={(product) => product.id}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={products.refetching}
              onRefresh={products.refetch}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={products.search ? 'No matching products' : 'No products yet'}
              description={
                products.search
                  ? 'Try a different search term.'
                  : 'Add your first product to start selling.'
              }
              icon={<PackagePlus size={28} color={theme.colors.mutedForeground} />}
              actionLabel={products.search ? undefined : 'Add Product'}
              onAction={products.search ? undefined : openCreate}
            />
          }
          renderItem={({ item }) => {
            const threshold = item.lowStockAlertQuantity ?? DEFAULT_LOW_STOCK_THRESHOLD;
            const lowStock = item.stock < threshold;

            return (
              <Card padding="lg">
                <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                  <Text style={{ fontSize: 26, lineHeight: 32 }}>
                    {iconFor(item, item.category, DEFAULT_PRODUCT_EMOJI)}
                  </Text>

                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" color="mutedForeground">
                      {item.sortOrder != null ? `#${item.sortOrder} · ` : ''}
                      {item.category?.name ?? 'Uncategorized'}
                      {item.sku ? ` · ${item.sku}` : ''}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: theme.spacing.md,
                        marginTop: theme.spacing.xs,
                      }}
                    >
                      <Text variant="money">{format(item.price)}</Text>
                      <Text
                        variant="smallMedium"
                        color={lowStock ? 'warning' : 'mutedForeground'}
                      >
                        {item.stock} in stock
                      </Text>
                    </View>
                  </View>

                  <Switch
                    value={item.isActive}
                    onValueChange={(isActive) =>
                      products.toggleActive({ id: item.id, isActive })
                    }
                  />
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    gap: theme.spacing.sm,
                    marginTop: theme.spacing.md,
                  }}
                >
                  <IconButton
                    accessibilityLabel={`Edit ${item.name}`}
                    onPress={() => openEdit(item)}
                  >
                    <Pencil size={16} color={theme.colors.foreground} />
                  </IconButton>
                  <IconButton
                    accessibilityLabel={`Delete ${item.name}`}
                    tone="destructive"
                    onPress={() => setDeleting(item)}
                  >
                    <Trash2 size={16} color={theme.colors.destructive} />
                  </IconButton>
                </View>
              </Card>
            );
          }}
        />
      )}

      <Fab onPress={openCreate} accessibilityLabel="Add product" />

      <ProductFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        categories={products.categories}
        saving={products.saving}
        onSubmit={(payload) =>
          editing ? products.update({ id: editing.id, payload }) : products.create(payload)
        }
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete Product"
        description={`"${deleting?.name}" will be removed from your catalog. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await products.remove(deleting.id);
          setDeleting(null);
        }}
        onDecline={() => setDeleting(null)}
      />
      </PageFade>
    </SafeAreaView>
  );
}
