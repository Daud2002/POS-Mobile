import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Pencil, Trash2, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { expensesApi, shiftsApi } from '@/api/services';
import { Expense, ExpensePayload } from '@/api/types';
import type { ExpenseFilters } from '@/api/services/expenses.api';
import { useAuth } from '@/app/providers/AuthProvider';
import { ShiftBar } from '@/features/shifts/components/ShiftBar';
import { effectiveRoleOf } from '@/lib/roles';
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
import { canManageExpenseCategories } from '@/lib/access';
import { localDateKey } from '@/lib/date';
import { expenseCategoryLabel } from '@/lib/expenses';
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

/** Filter pill values: 'all' (no filter), 'none' (the empty bucket), or an id. */
const ALL = 'all';

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

  const owner = canManageExpenseCategories(user);

  /**
   * A cashier or supervisor on a tenant with shifts on must have a drawer
   * open to touch the ledger: their cash spend comes off that drawer's
   * expected cash. The server refuses with a 409 either way; this explains
   * it and puts the "Open shift" button right here.
   */
  const role = effectiveRoleOf(user);
  const staff = role === 'cashier' || role === 'supervisor';
  const shiftsOn = staff && !!user?.shiftsEnabled;
  const shiftQuery = useQuery({
    queryKey: queryKeys.currentShift(),
    queryFn: () => shiftsApi.current(),
    enabled: shiftsOn,
  });
  const needsShift = shiftsOn && !shiftQuery.isLoading && !shiftQuery.data;

  /** False, with a toast, when the ledger is closed to this user right now. */
  const guardShift = () => {
    if (!needsShift) return true;
    toast.error('Open your shift first — expenses are counted against your drawer.');
    return false;
  };

  const [range, setRange] = useState('month');
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [subcategoryFilter, setSubcategoryFilter] = useState(ALL);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  /**
   * Range, category and subcategory together — "how much did I pay Ahmad for
   * petrol this month" is Petrol › Ahmad with the month pill, and the "Shown"
   * card is the answer.
   */
  const filters = useMemo<ExpenseFilters>(
    () => ({
      ...rangeBounds(range),
      categoryId: categoryFilter === ALL ? undefined : categoryFilter,
      subcategoryId:
        categoryFilter === ALL || categoryFilter === 'none' || subcategoryFilter === ALL
          ? undefined
          : subcategoryFilter,
    }),
    [range, categoryFilter, subcategoryFilter],
  );
  const filterKey = `${range}|${filters.categoryId ?? ALL}|${filters.subcategoryId ?? ALL}`;
  const today = localDateKey(new Date());

  const expensesQuery = useQuery({
    queryKey: queryKeys.expenses(filterKey),
    queryFn: () => expensesApi.list(filters),
  });

  const breakdownQuery = useQuery({
    queryKey: queryKeys.expenseBreakdown(filterKey),
    queryFn: () => expensesApi.breakdown(filters),
    enabled: breakdownOpen,
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
    // The drawer's cash paid-out moved with it.
    if (shiftsOn) queryClient.invalidateQueries({ queryKey: queryKeys.currentShift() });
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
  const categories = categoriesQuery.data ?? [];
  const breakdown = breakdownQuery.data ?? [];

  const categoryOptions = useMemo(
    () => [
      { value: ALL, label: 'All categories' },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
      { value: 'none', label: 'Uncategorized' },
    ],
    [categories],
  );
  const subcategoryOptions = useMemo(() => {
    const subs = categories.find((c) => c.id === categoryFilter)?.subcategories ?? [];
    if (!subs.length) return [];
    return [
      { value: ALL, label: 'All' },
      ...subs.map((s) => ({ value: s.id, label: s.name })),
      { value: 'none', label: 'No subcategory' },
    ];
  }, [categories, categoryFilter]);

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
                if (breakdownOpen) void breakdownQuery.refetch();
              }}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xs }}>
              {/* Staff only: the owner has no drawer, and the bar hides itself when shifts are off. */}
              {staff ? <ShiftBar /> : null}
              {needsShift ? (
                <Text variant="caption" color="mutedForeground">
                  Expenses are counted against your drawer, so open your shift before recording,
                  editing or deleting one.
                </Text>
              ) : null}
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
              <FilterPillRow
                options={categoryOptions}
                value={categoryFilter}
                onChange={(next) => {
                  setCategoryFilter(next);
                  setSubcategoryFilter(ALL);
                }}
              />
              {subcategoryOptions.length ? (
                <FilterPillRow
                  options={subcategoryOptions}
                  value={subcategoryFilter}
                  onChange={setSubcategoryFilter}
                />
              ) : null}

              <Card padding="lg">
                <Pressable
                  onPress={() => setBreakdownOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: breakdownOpen }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
                >
                  {breakdownOpen ? (
                    <ChevronDown size={16} color={theme.colors.mutedForeground} />
                  ) : (
                    <ChevronRight size={16} color={theme.colors.mutedForeground} />
                  )}
                  <Text variant="bodyMedium">By category</Text>
                </Pressable>
                {breakdownOpen ? (
                  <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                    {breakdownQuery.isLoading ? (
                      <SkeletonList count={2} lines={1} />
                    ) : breakdown.length === 0 ? (
                      <Text variant="caption" color="mutedForeground">
                        Nothing spent in this period.
                      </Text>
                    ) : (
                      breakdown.map((category) => (
                        <View key={category.categoryId ?? 'none'} style={{ gap: theme.spacing.xs }}>
                          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                            <Text variant="smallMedium" style={{ flex: 1 }} numberOfLines={1}>
                              {category.name} · {category.count}
                            </Text>
                            <Text variant="smallMedium">{format(category.total)}</Text>
                          </View>
                          {/* A lone "no subcategory" bucket would only repeat the category line. */}
                          {category.subcategories.some((s) => s.subcategoryId)
                            ? category.subcategories.map((s) => (
                                <View
                                  key={s.subcategoryId ?? 'none'}
                                  style={{
                                    flexDirection: 'row',
                                    gap: theme.spacing.md,
                                    paddingLeft: theme.spacing.lg,
                                  }}
                                >
                                  <Text
                                    variant="caption"
                                    color="mutedForeground"
                                    style={{ flex: 1 }}
                                    numberOfLines={1}
                                  >
                                    {s.name ?? 'No subcategory'} · {s.count}
                                  </Text>
                                  <Text variant="caption" color="mutedForeground">
                                    {format(s.total)}
                                  </Text>
                                </View>
                              ))
                            : null}
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </Card>
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
                  if (!guardShift()) return;
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
                      expenseCategoryLabel(item),
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
                    if (!guardShift()) return;
                    setEditing(item);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={16} color={theme.colors.foreground} />
                </IconButton>
                <IconButton
                  accessibilityLabel={`Delete ${item.title}`}
                  tone="destructive"
                  onPress={() => {
                    if (!guardShift()) return;
                    setDeleting(item);
                  }}
                >
                  <Trash2 size={16} color={theme.colors.destructive} />
                </IconButton>
              </View>
            </Card>
          )}
        />

        <Fab
          onPress={() => {
            if (!guardShift()) return;
            setEditing(null);
            setFormOpen(true);
          }}
          accessibilityLabel="Add expense"
        />

        <ExpenseFormSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          expense={editing}
          categories={categories}
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
