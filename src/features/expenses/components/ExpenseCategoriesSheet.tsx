import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { expensesApi } from '@/api/services';
import { ExpenseCategory } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/theme/ThemeProvider';

interface ExpenseCategoriesSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Owner-only management of the expense buckets.
 *
 * A sheet rather than a screen: staff granted the expenses module must not
 * find a menu row that only ever answers 403, and the owner reaches this from
 * the one place they would look for it.
 */
export function ExpenseCategoriesSheet({ open, onClose }: ExpenseCategoriesSheetProps) {
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<ExpenseCategory | null>(null);

  const query = useQuery({
    // Retired categories included: hiding them would make restoring one
    // impossible.
    queryKey: [...queryKeys.expenseCategories(), 'all'],
    queryFn: () => expensesApi.listCategories(true),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenseCategories() });
  };

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  const create = useMutation({
    mutationFn: () => expensesApi.createCategory({ name: name.trim() }),
    onSuccess: () => {
      toast.success('Category added');
      setName('');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not add the category.'),
  });

  const toggleActive = useMutation({
    mutationFn: (category: ExpenseCategory) =>
      expensesApi.updateCategory(category.id, { isActive: !category.isActive }),
    onSuccess: invalidate,
    onError: (error) => fail(error, 'Could not update the category.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => expensesApi.removeCategory(id),
    onSuccess: () => {
      toast.success('Category deleted');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not delete the category.'),
  });

  const categories = query.data ?? [];

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Expense Categories"
        footer={<Button label="Done" onPress={onClose} style={{ flex: 1 }} />}
      >
        <Text variant="caption" color="mutedForeground">
          Buckets your expenses are filed under. Retiring one hides it from the expense form
          without touching what's already been booked against it.
        </Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
          <Input
            containerStyle={{ flex: 1 }}
            label="New category"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rent, Utilities"
          />
          <Button
            label="Add"
            onPress={() => {
              if (!name.trim()) {
                toast.error('Name is required');
                return;
              }
              create.mutate();
            }}
            loading={create.isPending}
            disabled={create.isPending}
            icon={<Plus size={16} color={theme.colors.primaryForeground} />}
          />
        </View>

        {query.isLoading ? (
          <SkeletonList count={3} lines={1} />
        ) : categories.length === 0 ? (
          <Text variant="small" color="mutedForeground">
            No categories yet. Add your first above.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: theme.spacing.sm }}>
              {categories.map((category) => (
                <View
                  key={category.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <Text
                    variant="smallMedium"
                    style={{ flex: 1 }}
                    color={category.isActive ? 'foreground' : 'mutedForeground'}
                    numberOfLines={1}
                  >
                    {category.name}
                    {category.isActive ? '' : ' · retired'}
                  </Text>

                  <Button
                    label={category.isActive ? 'Retire' : 'Restore'}
                    variant="outline"
                    size="sm"
                    onPress={() => toggleActive.mutate(category)}
                  />

                  <IconButton
                    accessibilityLabel={`Delete ${category.name}`}
                    tone="destructive"
                    onPress={() => setDeleting(category)}
                  >
                    <Trash2 size={16} color={theme.colors.destructive} />
                  </IconButton>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title="Delete category"
        description="Expenses filed under it become uncategorized — none of them are deleted. Retire it instead if you only want it out of the form."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
          setDeleting(null);
        }}
        onDecline={() => setDeleting(null)}
      />
    </>
  );
}
