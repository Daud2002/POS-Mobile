import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { categoriesApi } from '@/api/services';
import { Category, CategoryPayload } from '@/api/types';
import { PageFade } from '@/components/layout/PageFade';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Fab } from '@/components/ui/Fab';
import { IconButton } from '@/components/ui/IconButton';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { categoryIcon } from '@/constants/emojis';
import { useStoreId } from '@/hooks/useStoreId';
import { useTheme } from '@/theme/ThemeProvider';

import { CategoryFormSheet } from '../components/CategoryFormSheet';

/** Product categories — these drive the POS category filter row. */
export function CategoriesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const storeId = useStoreId();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const query = useQuery({
    queryKey: queryKeys.categories(storeId ?? ''),
    queryFn: () => categoriesApi.list(storeId!, 0, 1000),
    enabled: !!storeId,
  });

  const invalidate = () => {
    if (storeId) queryClient.invalidateQueries({ queryKey: queryKeys.categories(storeId) });
  };

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  const save = useMutation({
    mutationFn: (payload: CategoryPayload) =>
      editing
        ? categoriesApi.update(editing.id, payload)
        : // The web app omits storeId here even though the screen guards on it,
          // so categories are created unattached. Mobile always sends it.
          categoriesApi.create({ ...payload, storeId }),
    onSuccess: () => {
      toast.success(editing ? 'Category updated' : 'Category created');
      invalidate();
      setFormOpen(false);
    },
    onError: (error) => fail(error, 'Could not save the category.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: () => {
      toast.success('Category deleted');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not delete the category.'),
  });

  const categories = query.data ?? [];

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <PageFade>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
        <SectionHeader title="Categories" subtitle={`${categories.length} total`} />
      </View>

      {query.isLoading ? (
        <View style={{ padding: theme.spacing.lg }}>
          <SkeletonList count={5} lines={1} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(category) => category.id}
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
              title="No categories yet"
              description="Group your products so the POS grid is easier to work with."
              icon={<FolderPlus size={28} color={theme.colors.mutedForeground} />}
              actionLabel="Add Category"
              onAction={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            />
          }
          renderItem={({ item }) => (
            <Card padding="lg">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                }}
              >
                <Text style={{ fontSize: 24, lineHeight: 30, opacity: item.image ? 1 : 0.4 }}>
                  {categoryIcon(item)}
                </Text>

                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{item.name}</Text>
                  {item.description ? (
                    <Text variant="caption" color="mutedForeground" numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>

                <IconButton
                  accessibilityLabel={`Edit ${item.name}`}
                  onPress={() => {
                    setEditing(item);
                    setFormOpen(true);
                  }}
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
          )}
        />
      )}

      <Fab
        onPress={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        accessibilityLabel="Add category"
      />

      <CategoryFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        category={editing}
        saving={save.isPending}
        onSubmit={save.mutateAsync}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete Category"
        description="Products in this category will become uncategorized."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
          setDeleting(null);
        }}
        onDecline={() => setDeleting(null)}
      />
      </PageFade>
    </SafeAreaView>
  );
}
