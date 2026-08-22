import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Save, X, Plus, Minus } from 'lucide-react-native';

import { restaurantApi, productsApi, categoriesApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { Button, EmptyState, Input, SearchInput, Sheet, Text, useToast } from '@/components/ui';
import { useStoreId } from '@/hooks/useStoreId';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { toNumber } from '@/lib/format';
import { tint, useTheme } from '@/theme';
import type { Decimal, RestaurantOrder, RestaurantTable } from '@/api/types';
import { ConnectionBanner } from '../components/ConnectionBanner';

interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export function WaiterScreen() {
  const theme = useTheme();
  const toast = useToast();
  const storeId = useStoreId();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [appendTo, setAppendTo] = useState<RestaurantOrder | null>(null);
  const [editingDraft, setEditingDraft] = useState<RestaurantOrder | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tablesQuery = useQuery({
    queryKey: queryKeys.restaurantTables(),
    queryFn: () => restaurantApi.listTables(),
  });

  const draftsQuery = useQuery({
    queryKey: queryKeys.restaurantOrders('draft'),
    queryFn: () => restaurantApi.listOrders({ orderStatus: 'draft' }),
  });

  const liveQuery = useQuery({
    queryKey: queryKeys.restaurantOrders('live'),
    queryFn: () => restaurantApi.listOrders({ orderStatus: 'requested,preparing' }),
  });

  const productsQuery = useQuery({
    queryKey: queryKeys.activeProducts(storeId ?? ''),
    queryFn: () => productsApi.listActive(storeId as string),
    enabled: !!storeId,
  });

  // The menu is organised by category, so the picker filters by it.
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(storeId ?? ''),
    queryFn: () => categoriesApi.list(storeId as string),
    enabled: !!storeId,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  // Table occupancy changes from other waiters and from the cashier settling,
  // so this must be live or two waiters will fight over one table.
  const { connected } = useRealtime({
    events: [
      RealtimeEvents.tableUpdated,
      RealtimeEvents.orderCreated,
      RealtimeEvents.orderUpdated,
      RealtimeEvents.draftUpdated,
    ],
    onChange: refresh,
  });

  const tables = tablesQuery.data ?? [];
  const drafts = draftsQuery.data ?? [];
  const liveOrders = liveQuery.data ?? [];

  const allProducts = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (activeCategory !== 'all' && p.categoryId !== activeCategory) return false;
      return q ? p.name?.toLowerCase().includes(q) : true;
    });
  }, [allProducts, search, activeCategory]);

  /** Counts per category, so an empty one is obvious before tapping it. */
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allProducts) {
      if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [allProducts]);

  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const addToCart = (product: { id: string; name: string; price: Decimal }) => {
    setCart((prev) => {
      const found = prev.find((l) => l.productId === product.id);
      if (found) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        { productId: product.id, name: product.name, price: toNumber(product.price), quantity: 1 },
      ];
    });
  };

  const changeQty = (productId: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );

  const reset = () => {
    setCart([]);
    setSelectedTable(null);
    setAppendTo(null);
    setEditingDraft(null);
    setCartOpen(false);
  };

  const itemsPayload = () =>
    cart.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      notes: l.notes?.trim() || undefined,
    }));

  const submit = async (asDraft: boolean) => {
    if (!cart.length) {
      toast.error('Add at least one item');
      return;
    }
    if (!asDraft && !appendTo && !selectedTable) {
      toast.error('Pick a table first');
      return;
    }

    setSubmitting(true);
    try {
      if (appendTo) {
        await restaurantApi.addItems(appendTo.id, itemsPayload());
        toast.success(`Added to ${appendTo.tableName ?? 'order'}`);
      } else if (editingDraft) {
        await restaurantApi.updateDraft(editingDraft.id, {
          items: itemsPayload(),
          tableId: selectedTable?.id,
          version: editingDraft.version,
        });
        if (!asDraft) {
          await restaurantApi.punch(editingDraft.id, selectedTable?.id);
          toast.success('Order sent to kitchen');
        } else {
          toast.success('Draft saved');
        }
      } else {
        await restaurantApi.createOrder({
          orderType: 'dine_in',
          tableId: selectedTable?.id,
          items: itemsPayload(),
          isDraft: asDraft,
        });
        toast.success(asDraft ? 'Draft saved' : 'Order sent to kitchen');
      }
      reset();
      refresh();
    } catch (error: any) {
      // A 409 means another waiter claimed the table first. The cart is kept
      // so the order can simply be re-aimed at a different table.
      toast.error(error?.message ?? 'Could not send the order');
      refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const openDraft = (draft: RestaurantOrder) => {
    setEditingDraft(draft);
    setAppendTo(null);
    setSelectedTable(tables.find((t) => t.id === draft.tableId) ?? null);
    setCart(
      (draft.items ?? []).map((item) => ({
        productId: item.productId,
        name: item.productName,
        price: toNumber(item.unitPrice),
        quantity: item.quantity,
        notes: item.notes ?? undefined,
      })),
    );
    setCartOpen(true);
  };

  return (
    <Screen scrollable refreshing={tablesQuery.isRefetching} onRefresh={refresh}>
      <View style={styles.stack}>
        <ConnectionBanner connected={connected} />

        <Text variant="h2">Tables</Text>
        <View style={styles.tableGrid}>
          {tables.map((table) => {
            const live = liveOrders.find((o) => o.tableId === table.id);
            const free = table.status === 'free';
            const selected = selectedTable?.id === table.id;
            return (
              <Pressable
                key={table.id}
                onPress={() => {
                  if (free) {
                    setAppendTo(null);
                    setSelectedTable(selected ? null : table);
                    if (!selected) setCartOpen(true);
                  } else if (live) {
                    // Occupied: adding a round rather than starting an order.
                    setAppendTo(live);
                    setEditingDraft(null);
                    setSelectedTable(null);
                    setCart([]);
                    setCartOpen(true);
                  }
                }}
                style={[
                  styles.tableCard,
                  {
                    borderRadius: theme.radius.md,
                    borderColor: selected
                      ? theme.colors.primary
                      : free
                        ? theme.colors.border
                        : tint(theme.colors.warning, 0.5),
                    backgroundColor: selected
                      ? tint(theme.colors.primary, 0.1)
                      : free
                        ? theme.colors.card
                        : tint(theme.colors.warning, 0.08),
                  },
                ]}
              >
                <Text variant="bodySemibold" numberOfLines={1}>{table.name}</Text>
                <Text
                  variant="caption"
                  style={{ color: free ? theme.colors.success : theme.colors.warning }}
                >
                  {free ? 'Free' : 'Occupied'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {tables.length === 0 && !tablesQuery.isLoading && (
          <EmptyState title="No tables" description="The owner has not added any tables yet." />
        )}

        {drafts.length > 0 && (
          <>
            <Text variant="h2">Drafts</Text>
            <View style={{ gap: 8 }}>
              {drafts.map((draft) => (
                <Pressable
                  key={draft.id}
                  onPress={() => openDraft(draft)}
                  style={[
                    styles.draftRow,
                    { borderColor: theme.colors.border, borderRadius: theme.radius.md },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySemibold" numberOfLines={1}>
                      {draft.tableName ?? 'No table'} · {draft.items?.length ?? 0} items
                    </Text>
                    <Text variant="caption" color="mutedForeground">
                      by {draft.waiterName ?? 'Unknown'}
                    </Text>
                  </View>
                  <Text variant="bodySemibold">{format(toNumber(draft.total))}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text variant="h2">Menu</Text>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search dishes…" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          <Pressable
            onPress={() => setActiveCategory('all')}
            style={[
              styles.categoryPill,
              {
                borderRadius: theme.radius.full,
                borderColor: activeCategory === 'all' ? theme.colors.primary : theme.colors.border,
                backgroundColor:
                  activeCategory === 'all' ? tint(theme.colors.primary, 0.1) : 'transparent',
              },
            ]}
          >
            <Text variant="caption">All ({allProducts.length})</Text>
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setActiveCategory(category.id)}
              style={[
                styles.categoryPill,
                {
                  borderRadius: theme.radius.full,
                  borderColor:
                    activeCategory === category.id ? theme.colors.primary : theme.colors.border,
                  backgroundColor:
                    activeCategory === category.id
                      ? tint(theme.colors.primary, 0.1)
                      : 'transparent',
                },
              ]}
            >
              <Text variant="caption">
                {category.name} ({categoryCounts.get(category.id) ?? 0})
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {products.length === 0 && !productsQuery.isLoading && (
          <Text variant="caption" color="mutedForeground">
            No dishes in this category.
          </Text>
        )}

        <View style={styles.productGrid}>
          {products.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => { addToCart(product as any); setCartOpen(true); }}
              style={[
                styles.productCard,
                { borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.card },
              ]}
            >
              <Text variant="bodySemibold" numberOfLines={2}>{product.name}</Text>
              <Text variant="caption" color="mutedForeground">
                {format(toNumber(product.price))}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={appendTo ? 'Add a round' : editingDraft ? 'Edit draft' : 'New order'}
      >
        <ScrollView style={{ maxHeight: 420 }}>
          <Text variant="caption" color="mutedForeground">
            {appendTo
              ? `Adding to ${appendTo.tableName ?? 'order'} — the kitchen only sees the new items.`
              : selectedTable
                ? `Table: ${selectedTable.name}`
                : 'Pick a free table, or save as a draft to send later.'}
          </Text>

          {cart.length === 0 ? (
            <Text variant="caption" color="mutedForeground" style={{ paddingVertical: 24 }}>
              No items yet.
            </Text>
          ) : (
            <View style={{ gap: 12, paddingVertical: 12 }}>
              {cart.map((line) => (
                <View key={line.productId} style={{ gap: 6 }}>
                  <View style={styles.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodySemibold" numberOfLines={1}>{line.name}</Text>
                      <Text variant="caption" color="mutedForeground">{format(line.price)}</Text>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable onPress={() => changeQty(line.productId, -1)} style={styles.stepBtn}>
                        <Minus size={14} color={theme.colors.foreground} />
                      </Pressable>
                      <Text variant="bodySemibold">{line.quantity}</Text>
                      <Pressable onPress={() => changeQty(line.productId, 1)} style={styles.stepBtn}>
                        <Plus size={14} color={theme.colors.foreground} />
                      </Pressable>
                    </View>
                  </View>
                  <Input
                    value={line.notes ?? ''}
                    onChangeText={(text) =>
                      setCart((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, notes: text } : l)),
                      )
                    }
                    placeholder="Note for kitchen…"
                  />
                </View>
              ))}
            </View>
          )}

          <View style={styles.totalRow}>
            <Text variant="bodySemibold">Total</Text>
            <Text variant="bodySemibold">{format(cartTotal)}</Text>
          </View>

          <View style={{ gap: 8, paddingTop: 12 }}>
            <Button
              onPress={() => submit(false)}
              loading={submitting}
              disabled={!cart.length}
              icon={<Send size={16} color={theme.colors.primaryForeground} />}
              label={appendTo ? 'Send round to kitchen' : 'Send to kitchen'}
            />
            {!appendTo && (
              <>
                <Button
                  variant="outline"
                  onPress={() => submit(true)}
                  disabled={submitting || !cart.length}
                  icon={<Save size={16} color={theme.colors.foreground} />}
                  label="Save as draft"
                />
                <Text variant="caption" color="mutedForeground">
                  A draft does not reserve the table — anyone can still take it.
                </Text>
              </>
            )}
            {(cart.length > 0 || appendTo || editingDraft) && (
              <Button variant="ghost" onPress={reset} icon={<X size={16} color={theme.colors.mutedForeground} />}
                  label="Clear"
                />
            )}
          </View>
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  tableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tableCard: { width: '31%', borderWidth: 1, padding: 12, gap: 2 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  categoryPill: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  productCard: { width: '48%', borderWidth: 1, padding: 12, gap: 4 },
  draftRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, padding: 12,
  },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { padding: 6 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
});
