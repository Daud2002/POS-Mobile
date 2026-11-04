import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { expensesApi } from '@/api/services';
import { ExpenseCategory, ExpenseSubcategory } from '@/api/types';
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
 * Owner/supervisor management of the expense buckets and the subcategories
 * under them ("Petrol" → "Ahmad").
 *
 * A sheet rather than a screen: staff granted the expenses module must not
 * find a menu row that only ever answers 403, and the owner reaches this from
 * the one place they would look for it. Staff still ADD subcategories, from
 * the expense form; tidying them up happens here.
 */
export function ExpenseCategoriesSheet({ open, onClose }: ExpenseCategoriesSheetProps) {
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<ExpenseCategory | null>(null);
  /** The category whose subcategories are showing. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deletingSub, setDeletingSub] = useState<ExpenseSubcategory | null>(null);

  const query = useQuery({
    // Retired categories included: hiding them would make restoring one
    // impossible.
    queryKey: [...queryKeys.expenseCategories(), 'all'],
    queryFn: () => expensesApi.listCategories(true),
    enabled: open,
  });

  // The whole 'expenses' prefix, not just the category lists: a renamed or
  // deleted subcategory changes how every listed expense and the breakdown read.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
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

  const createSub = useMutation({
    mutationFn: (categoryId: string) => expensesApi.createSubcategory(categoryId, subName.trim()),
    onSuccess: () => {
      toast.success('Subcategory added');
      setSubName('');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not add the subcategory.'),
  });

  const renameSub = useMutation({
    mutationFn: (target: { id: string; name: string }) =>
      expensesApi.updateSubcategory(target.id, { name: target.name.trim() }),
    onSuccess: () => {
      setRenaming(null);
      invalidate();
    },
    onError: (error) => fail(error, 'Could not rename the subcategory.'),
  });

  const toggleSub = useMutation({
    mutationFn: (subcategory: ExpenseSubcategory) =>
      expensesApi.updateSubcategory(subcategory.id, { isActive: !subcategory.isActive }),
    onSuccess: invalidate,
    onError: (error) => fail(error, 'Could not update the subcategory.'),
  });

  const removeSub = useMutation({
    mutationFn: (id: string) => expensesApi.removeSubcategory(id),
    onSuccess: () => {
      toast.success('Subcategory deleted');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not delete the subcategory.'),
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
          without touching what's already been booked against it. Tap a category to manage its
          subcategories (who or what within it, e.g. Petrol › Ahmad).
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
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: theme.spacing.sm }}>
              {categories.map((category) => {
                const expanded = expandedId === category.id;
                const subcategories = category.subcategories ?? [];
                const Chevron = expanded ? ChevronDown : ChevronRight;
                return (
                  <View
                    key={category.id}
                    style={{
                      gap: theme.spacing.sm,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Pressable
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        accessibilityLabel={`${category.name} subcategories`}
                        onPress={() => {
                          setExpandedId(expanded ? null : category.id);
                          setSubName('');
                          setRenaming(null);
                        }}
                      >
                        <Chevron size={16} color={theme.colors.mutedForeground} />
                        <Text
                          variant="smallMedium"
                          style={{ flex: 1 }}
                          color={category.isActive ? 'foreground' : 'mutedForeground'}
                          numberOfLines={1}
                        >
                          {category.name}
                          {category.isActive ? '' : ' · retired'}
                          {subcategories.length ? ` (${subcategories.length})` : ''}
                        </Text>
                      </Pressable>

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

                    {expanded ? (
                      <View style={{ gap: theme.spacing.sm, paddingLeft: theme.spacing.lg }}>
                        {subcategories.length === 0 ? (
                          <Text variant="caption" color="mutedForeground">
                            No subcategories yet.
                          </Text>
                        ) : null}
                        {subcategories.map((subcategory) =>
                          renaming?.id === subcategory.id ? (
                            <View
                              key={subcategory.id}
                              style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}
                            >
                              <Input
                                containerStyle={{ flex: 1 }}
                                value={renaming.name}
                                onChangeText={(text) => setRenaming({ id: subcategory.id, name: text })}
                                autoFocus
                              />
                              <IconButton
                                accessibilityLabel={`Save ${subcategory.name}`}
                                onPress={() => {
                                  if (!renaming.name.trim()) {
                                    toast.error('Name is required');
                                    return;
                                  }
                                  renameSub.mutate(renaming);
                                }}
                              >
                                <Check size={16} color={theme.colors.foreground} />
                              </IconButton>
                            </View>
                          ) : (
                            <View
                              key={subcategory.id}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
                            >
                              <Text
                                variant="small"
                                style={{ flex: 1 }}
                                color={subcategory.isActive ? 'foreground' : 'mutedForeground'}
                                numberOfLines={1}
                              >
                                {subcategory.name}
                                {subcategory.isActive ? '' : ' · retired'}
                              </Text>
                              <IconButton
                                accessibilityLabel={`Rename ${subcategory.name}`}
                                onPress={() => setRenaming({ id: subcategory.id, name: subcategory.name })}
                              >
                                <Pencil size={14} color={theme.colors.foreground} />
                              </IconButton>
                              <Button
                                label={subcategory.isActive ? 'Retire' : 'Restore'}
                                variant="outline"
                                size="sm"
                                onPress={() => toggleSub.mutate(subcategory)}
                              />
                              <IconButton
                                accessibilityLabel={`Delete ${subcategory.name}`}
                                tone="destructive"
                                onPress={() => setDeletingSub(subcategory)}
                              >
                                <Trash2 size={14} color={theme.colors.destructive} />
                              </IconButton>
                            </View>
                          ),
                        )}

                        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
                          <Input
                            containerStyle={{ flex: 1 }}
                            value={subName}
                            onChangeText={setSubName}
                            placeholder="New subcategory, e.g. Ahmad"
                          />
                          <Button
                            label="Add"
                            size="sm"
                            onPress={() => {
                              if (!subName.trim()) {
                                toast.error('Name is required');
                                return;
                              }
                              createSub.mutate(category.id);
                            }}
                            loading={createSub.isPending}
                            disabled={createSub.isPending}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title="Delete category"
        description="Expenses filed under it become uncategorized and its subcategories go with it — none of the expenses are deleted. Retire it instead if you only want it out of the form."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
          setDeleting(null);
        }}
        onDecline={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={!!deletingSub}
        title="Delete subcategory"
        description={`Expenses filed under "${deletingSub?.name}" keep their category and lose only the subcategory. Retire it instead if you only want it out of the form.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deletingSub) await removeSub.mutateAsync(deletingSub.id);
          setDeletingSub(null);
        }}
        onDecline={() => setDeletingSub(null)}
      />
    </>
  );
}
