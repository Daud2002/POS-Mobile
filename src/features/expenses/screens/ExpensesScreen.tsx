import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { expensesApi } from '@/api/services';
import { Expense, ExpensePayload } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { StatCard } from '@/components/data/StatCard';
import { StatRow } from '@/components/data/StatRow';
import { PageFade } from '@/components/layout/PageFade';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Fab } from '@/components/ui/Fab';
import { FilterPillRow } from '@/components/ui/FilterPill';
import { IconButton } from '@/components/ui/IconButton';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { isOwner } from '@/lib/access';
import { localDateKey } from '@/lib/date';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { ExpenseCategoriesSheet } from '../components/ExpenseCategoriesSheet';
import { ExpenseFormSheet } from '../components/ExpenseFormSheet';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

/** Inclusive day bounds for a range key, in the device's local calendar. */
function rangeBounds(key: string): { from?: string; to?: string } {
  const today = localDateKey(new Date());
  if (key === 'today') return { from: today, to: today };
  if (key === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (key === '30d') {
    return { from: localDateKey(new Date(Date.now() - 29 * 864e5)), to: today };
  }
  return {};
}

/**
 * The store's spend ledger — one shared book, not a per-user one.
 *
 * Open to the owner and to any staff member granted the expenses module. The
 * only difference between the two views is the "Categories" button, which is
 * owner-only both here and on the server.
 */
export function ExpensesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const owner = isOwner(user);
  const [range, setRange] = useState('month');
  const [formOpen, setFormOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const bounds = useMemo(() => rangeBounds(range), [range]);
  const today = localDateKey(new Date());

  const expensesQuery = useQuery({
    queryKey: queryKeys.expenses(range),
    queryFn: () => expensesApi.list(bounds),
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.expenseSummary(today),
    queryFn: () => expensesApi.summary(today),
  });

  // Only live categories: the form must not offer a retired bucket.
  const categoriesQuery = useQuery({
    queryKey: queryKeys.expenseCategories(),
    queryFn: () => expensesApi.listCategories(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  };

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  const save = useMutation({
    mutationFn: (payload: ExpensePayload) =>
      editing ? expensesApi.update(editing.id, payload) : expensesApi.create(payload),
    onSuccess: () => {
      toast.success(editing ? 'Expense updated' : 'Expense recorded');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not save the expense.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      toast.success('Expense deleted');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not delete the expense.'),
  });

  const expenses = expensesQuery.data ?? [];
  const summary = summaryQuery.data;

  // Summed from the loaded rows, which is the whole range: the mobile list is
  // not paged, so this cannot disagree with what is on screen.
  const rangeTotal = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <PageFade>
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
          <SectionHeader
            title="Expenses"
            subtitle={`${expenses.length} in this period`}
            action={
              owner ? (
                <Button
                  label="Categories"
                  variant="outline"
                  size="sm"
                  onPress={() => setCategoriesOpen(true)}
                />
              ) : undefined
            }
          />
        </View>

        <FlatList
          data={expenses}
          keyExtractor={(expense) => expense.id}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={expensesQuery.isRefetching}
              onRefresh={() => {
                void expensesQuery.refetch();
                void summaryQuery.refetch();
              }}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xs }}>
              <StatRow>
                <StatCard
                  title="Today"
                  value={format(summary?.today ?? 0)}
                  tone="warning"
                  icon={<Wallet size={19} color={theme.colors.warning} />}
                  loading={summaryQuery.isLoading}
                />
                <StatCard
                  title="This month"
                  value={format(summary?.month ?? 0)}
                  tone="info"
                  icon={<Wallet size={19} color={theme.colors.info} />}
                  loading={summaryQuery.isLoading}
                />
                <StatCard
                  title="Shown"
                  value={format(rangeTotal)}
                  tone="primary"
                  icon={<Wallet size={19} color={theme.colors.primary} />}
                  loading={expensesQuery.isLoading}
                />
              </StatRow>

              <FilterPillRow options={RANGES} value={range} onChange={setRange} />
            </View>
          }
          ListEmptyComponent={
            expensesQuery.isLoading ? (
              <SkeletonList count={4} lines={2} />
            ) : (
              <EmptyState
                title="Nothing recorded"
                description="No expenses in this period. Tap + to record what the store has spent."
                icon={<Wallet size={28} color={theme.colors.mutedForeground} />}
                actionLabel="Add Expense"
                onAction={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              />
            )
          }
          renderItem={({ item }) => (
            <Card padding="lg">
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                    {/* `expenseDate` is already a plain day — rendering it via
                        `new Date()` would apply the device offset. */}
                    {[
                      item.expenseDate,
                      item.category?.name ?? 'Uncategorized',
                      item.paymentMethod,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {item.notes ? (
                    <Text variant="caption" color="mutedForeground" numberOfLines={2}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>

                <Text variant="bodyMedium">{format(toNumber(item.amount))}</Text>
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
                  accessibilityLabel={`Edit ${item.title}`}
                  onPress={() => {
                    setEditing(item);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={16} color={theme.colors.foreground} />
                </IconButton>
                <IconButton
                  accessibilityLabel={`Delete ${item.title}`}
                  tone="destructive"
                  onPress={() => setDeleting(item)}
                >
                  <Trash2 size={16} color={theme.colors.destructive} />
                </IconButton>
              </View>
            </Card>
          )}
        />

        <Fab
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          accessibilityLabel="Add expense"
        />

        <ExpenseFormSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          expense={editing}
          categories={categoriesQuery.data ?? []}
          saving={save.isPending}
          onSubmit={save.mutateAsync}
        />

        {owner ? (
          <ExpenseCategoriesSheet
            open={categoriesOpen}
            onClose={() => setCategoriesOpen(false)}
          />
        ) : null}

        <ConfirmDialog
          open={!!deleting}
          title="Delete expense"
          description={`"${deleting?.title}" will be removed from the ledger permanently.`}
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
