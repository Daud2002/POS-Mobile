import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Receipt, Ban, Plus, Minus } from 'lucide-react-native';

import { restaurantApi, storesApi, productsApi, categoriesApi, shiftsApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import { Screen } from '@/components/layout';
import { Button, EmptyState, Input, SearchInput, Sheet, Text, useToast } from '@/components/ui';
import { iconFor } from '@/constants/emojis';
import { useStoreId } from '@/hooks/useStoreId';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { toNumber } from '@/lib/format';
import { sortBySortOrder } from '@/lib/sortOrder';
import { orderDestination, orderLabel, orderStatusLabel } from '@/lib/orderLabel';
import { parseDiscountInput, previewDiscount } from '@/lib/discount';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { receiptFromRestaurantOrder } from '@/features/printing/templates/receiptFromOrder';
import { tint, useTheme } from '@/theme';
import type { Decimal, RestaurantOrder } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { ConnectionBanner } from '../components/ConnectionBanner';

const PAYMENT_METHODS = ['cash', 'card', 'online'] as const;

/** Open orders, most-ready first. */
const STATUS_PRIORITY: Record<string, number> = {
  handed_over: 0,
  preparing: 1,
  requested: 2,
  draft: 3,
};

export function RestaurantCashierScreen() {
  const theme = useTheme();
  const toast = useToast();
  const storeId = useStoreId();
  const { user } = useAuth();
  const { format, currency } = useStoreCurrency();
  const queryClient = useQueryClient();
  const { printReceipt } = usePrinter();

  const [selected, setSelected] = useState<RestaurantOrder | null>(null);
  const [discountText, setDiscountText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [settling, setSettling] = useState(false);

  /**
   * The open-drawer gate. Opening and closing a shift lives on the My Shift
   * tab now; the till only needs to know whether settling is allowed.
   */
  const shiftQuery = useQuery({
    queryKey: queryKeys.currentShift(),
    queryFn: () => shiftsApi.current(),
    enabled: !!user?.shiftsEnabled,
  });
  const shift = shiftQuery.data ?? null;

  // Takeaway / delivery composer — the cashier's own order entry.
  const [composerOpen, setComposerOpen] = useState(false);
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<
    Array<{ productId: string; name: string; icon: string; price: number; quantity: number }>
  >([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [creating, setCreating] = useState(false);

  const ordersQuery = useQuery({
    queryKey: queryKeys.restaurantOrders('open'),
    queryFn: () =>
      restaurantApi
        .listOrders({ orderStatus: 'requested,preparing,handed_over,draft' })
        // Handed-over orders first: the food is out and the guests are ready
        // to pay, so sinking them below tickets the kitchen has not started
        // is backwards for the person holding the card machine.
        .then((rows) =>
          [...rows].sort(
            (a, b) =>
              (STATUS_PRIORITY[a.orderStatus] ?? 9) - (STATUS_PRIORITY[b.orderStatus] ?? 9),
          ),
        ),
  });

  const storeQuery = useQuery({
    queryKey: queryKeys.store(storeId ?? ''),
    queryFn: () => storesApi.getById(storeId as string),
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
  });

  const productsQuery = useQuery({
    queryKey: queryKeys.activeProducts(storeId ?? ''),
    queryFn: () => productsApi.listActive(storeId as string),
    enabled: !!storeId,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(storeId ?? ''),
    queryFn: () => categoriesApi.list(storeId as string),
    enabled: !!storeId,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  }, [queryClient]);

  const { connected } = useRealtime({
    events: [
      RealtimeEvents.orderCreated,
      RealtimeEvents.orderUpdated,
      RealtimeEvents.orderItemsAdded,
      RealtimeEvents.tableUpdated,
    ],
    onChange: refresh,
  });

  const orders = ordersQuery.data ?? [];
  const allProducts = productsQuery.data ?? [];
  // The owner's menu order, the same one the web till shows.
  const categories = useMemo(
    () => sortBySortOrder(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  // Menu is organised by category, so the composer filters the same way the
  // waiter screen does. Sorted AFTER filtering, so one category reads in the
  // same relative order its dishes have under "All".
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortBySortOrder(
      allProducts.filter((p) => {
        if (activeCategory !== 'all' && p.categoryId !== activeCategory) return false;
        return q ? p.name?.toLowerCase().includes(q) : true;
      }),
    );
  }, [allProducts, search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allProducts) {
      if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [allProducts]);

  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  /** A dish with no icon of its own borrows its category's. */
  const iconOf = (product: { categoryId?: string; image?: string | null }) =>
    iconFor(product, product.categoryId ? categoryById.get(product.categoryId) : null);

  const addToCart = (product: {
    id: string;
    name: string;
    price: Decimal;
    categoryId?: string;
    image?: string | null;
  }) =>
    setCart((prev) => {
      const found = prev.find((l) => l.productId === product.id);
      if (found) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        // Resolved once, here: a cart line carries no category of its own.
        icon: iconOf(product),
        price: toNumber(product.price),
        quantity: 1,
      }];
    });

  const changeQty = (productId: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );

  const createOrder = async (asDraft: boolean) => {
    if (!cart.length) {
      toast.error('Add at least one item');
      return;
    }
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      toast.error('A delivery order needs an address');
      return;
    }
    setCreating(true);
    try {
      await restaurantApi.createOrder({
        orderType,
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        isDraft: asDraft,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
      });
      toast.success(asDraft ? 'Draft saved' : 'Order sent to kitchen');
      setComposerOpen(false);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  const subtotal = useMemo(
    () => (selected?.items ?? []).reduce((sum, i) => sum + toNumber(i.total), 0),
    [selected],
  );
  const discountPreview = useMemo(
    () => previewDiscount(discountText, subtotal),
    [discountText, subtotal],
  );

  const settle = async () => {
    if (!selected) return;
    setSettling(true);
    try {
      const { discountType, discountValue } = parseDiscountInput(discountText);
      const settled = await restaurantApi.settle(selected.id, {
        discountType: discountType ?? undefined,
        discountValue: discountValue ?? undefined,
        paymentMethod,
      });

      // Print from the SERVER's numbers, never the local preview, so paper
      // always matches what was stored.
      const result = await printReceipt(
        receiptFromRestaurantOrder({
          order: settled,
          store: storeQuery.data,
          currency,
        }),
      );
      if (!result.ok) toast.error(result.error ?? 'Receipt printing failed');

      toast.success(selected.tableName ? `${selected.tableName} is now free` : 'Order settled');
      setSelected(null);
      setDiscountText('');
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to settle order');
    } finally {
      setSettling(false);
    }
  };

  const cancel = async () => {
    if (!selected) return;
    try {
      await restaurantApi.cancel(selected.id);
      toast.success('Order cancelled');
      setSelected(null);
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to cancel');
    }
  };

  return (
    <Screen scrollable refreshing={ordersQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: 12 }}>
        <ConnectionBanner connected={connected} />
        <View style={styles.headerRow}>
          <Text variant="h2">Cashier · {orders.length} open</Text>
          <Button
            size="sm"
            onPress={() => setComposerOpen(true)}
            icon={<Plus size={16} color={theme.colors.primaryForeground} />}
            label="New order"
          />
        </View>

        {orders.length === 0 && !ordersQuery.isLoading ? (
          <EmptyState
            icon={<Receipt size={28} color={theme.colors.mutedForeground} />}
            title="No open orders"
            description="Orders sent by waiters appear here."
          />
        ) : (
          orders.map((order) => (
            <Pressable
              key={order.id}
              onPress={() => { setSelected(order); setDiscountText(''); }}
              style={[
                styles.row,
                {
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodySemibold" numberOfLines={1}>
                  {orderDestination(order)}
                  {order.customerName ? ` · ${order.customerName}` : ''}
                  {/* The kitchen is done — this is the one to reach for next. */}
                  {order.orderStatus === 'handed_over' ? (
                    <Text variant="caption" style={{ color: theme.colors.success }}>
                      {'  '}Ready to bill
                    </Text>
                  ) : null}
                </Text>
                <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                  {orderLabel(order)} · {order.waiterName ?? 'Unknown'} ·{' '}
                  {order.items?.length ?? 0} items · {orderStatusLabel(order.orderStatus)}
                </Text>
              </View>
              <Text variant="bodySemibold">{format(toNumber(order.total))}</Text>
            </Pressable>
          ))
        )}
      </View>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? orderDestination(selected) : ''}
      >
        {selected && (
          <ScrollView style={{ maxHeight: 460 }}>
            <View style={{ gap: 4 }}>
              {(selected.items ?? []).map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {item.quantity} × {item.productName}
                  </Text>
                  <Text variant="body">{format(toNumber(item.total))}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.divider, { borderColor: theme.colors.border }]} />

            <View style={styles.itemRow}>
              <Text variant="caption" color="mutedForeground">Subtotal</Text>
              <Text variant="body">{format(subtotal)}</Text>
            </View>

            <View style={{ paddingTop: 10, gap: 4 }}>
              <Text variant="caption">Discount</Text>
              <Input
                value={discountText}
                onChangeText={setDiscountText}
                placeholder="250 or 25%"
                autoCapitalize="none"
              />
              <Text variant="caption" color="mutedForeground">
                Type 250 for a flat amount off, or 25% for a quarter off the order.
              </Text>
            </View>

            {discountPreview > 0 && (
              <View style={styles.itemRow}>
                <Text variant="caption" style={{ color: theme.colors.destructive }}>Discount</Text>
                <Text variant="body" style={{ color: theme.colors.destructive }}>
                  -{format(discountPreview)}
                </Text>
              </View>
            )}

            <View style={[styles.itemRow, { paddingTop: 8 }]}>
              <Text variant="bodySemibold">Total</Text>
              <Text variant="bodySemibold">
                {format(Math.max(subtotal - discountPreview, 0))}
              </Text>
            </View>

            <View style={{ paddingTop: 12, gap: 6 }}>
              <Text variant="caption">Payment</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PAYMENT_METHODS.map((method) => (
                  <Pressable
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    style={[
                      styles.payBtn,
                      {
                        borderRadius: theme.radius.md,
                        borderColor:
                          paymentMethod === method ? theme.colors.primary : theme.colors.border,
                        backgroundColor:
                          paymentMethod === method
                            ? tint(theme.colors.primary, 0.1)
                            : 'transparent',
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ textTransform: 'capitalize' }}>{method}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ paddingTop: 14, gap: 8 }}>
              <Button
                onPress={settle}
                loading={settling}
                disabled={
                  selected.orderStatus === 'draft' ||
                  // The server rejects this too; disabling here is only so the
                  // cashier is told why before they try.
                  (!!user?.shiftsEnabled && !shift)
                }
                icon={<Printer size={16} color={theme.colors.primaryForeground} />}
                  label="Print receipt & settle"
                />
              {selected.orderStatus === 'draft' && (
                <Text variant="caption" color="mutedForeground">
                  This is still a draft. A waiter must send it to the kitchen first.
                </Text>
              )}
              {!!user?.shiftsEnabled && !shift && selected.orderStatus !== 'draft' && (
                <Text variant="caption" style={{ color: theme.colors.warning }}>
                  Open your shift on the My Shift tab first — payments have to be
                  counted against a drawer.
                </Text>
              )}
              {selected.tableName ? (
                <Text variant="caption" color="mutedForeground">
                  Settling frees {selected.tableName} for the next customer.
                </Text>
              ) : null}
              <Button
                variant="outline"
                onPress={cancel}
                icon={<Ban size={16} color={theme.colors.destructive} />}
                  label="Cancel order"
                />
            </View>
          </ScrollView>
        )}
      </Sheet>

      <Sheet
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title={`New ${orderType} order`}
      >
        <ScrollView style={{ maxHeight: 460 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10 }}>
            {(['takeaway', 'delivery'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setOrderType(type)}
                style={[
                  styles.payBtn,
                  {
                    borderRadius: theme.radius.md,
                    borderColor: orderType === type ? theme.colors.primary : theme.colors.border,
                    backgroundColor:
                      orderType === type ? tint(theme.colors.primary, 0.1) : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ textTransform: 'capitalize' }}>{type}</Text>
              </Pressable>
            ))}
          </View>

          <Input value={customerName} onChangeText={setCustomerName} placeholder="Customer name" />
          <Input value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone" keyboardType="phone-pad" />
          {orderType === 'delivery' && (
            <Input
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder="Delivery address"
            />
          )}

          <View style={{ paddingTop: 10 }}>
            <SearchInput value={search} onChangeText={setSearch} placeholder="Search dishes…" />
          </View>

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
                  borderColor:
                    activeCategory === 'all' ? theme.colors.primary : theme.colors.border,
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
                  {category.image ? `${category.image} ` : ''}
                  {category.name} ({categoryCounts.get(category.id) ?? 0})
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.productGrid}>
            {filteredProducts.length === 0 && (
              <Text variant="caption" color="mutedForeground">No dishes in this category.</Text>
            )}
            {filteredProducts.map((product) => (
              <Pressable
                key={product.id}
                onPress={() => addToCart(product as any)}
                style={[
                  styles.productCard,
                  {
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.card,
                  },
                ]}
              >
                <Text style={{ fontSize: 20, lineHeight: 26 }}>{iconOf(product)}</Text>
                <Text variant="bodySemibold" numberOfLines={2}>{product.name}</Text>
                <Text variant="caption" color="mutedForeground">
                  {format(toNumber(product.price))}
                </Text>
              </Pressable>
            ))}
          </View>

          {cart.length > 0 && (
            <View style={{ gap: 8, paddingTop: 10 }}>
              <View style={[styles.divider, { borderColor: theme.colors.border }]} />
              {cart.map((line) => (
                <View key={line.productId} style={styles.itemRow}>
                  <Text style={{ fontSize: 16, lineHeight: 22 }}>{line.icon}</Text>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{line.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable onPress={() => changeQty(line.productId, -1)}>
                      <Minus size={14} color={theme.colors.foreground} />
                    </Pressable>
                    <Text variant="bodySemibold">{line.quantity}</Text>
                    <Pressable onPress={() => changeQty(line.productId, 1)}>
                      <Plus size={14} color={theme.colors.foreground} />
                    </Pressable>
                  </View>
                </View>
              ))}
              <View style={styles.itemRow}>
                <Text variant="bodySemibold">Total</Text>
                <Text variant="bodySemibold">{format(cartTotal)}</Text>
              </View>
            </View>
          )}

          <View style={{ gap: 8, paddingTop: 14 }}>
            <Button
              onPress={() => createOrder(false)}
              loading={creating}
              disabled={!cart.length}
              label="Send to kitchen"
            />
            <Button
              variant="outline"
              onPress={() => createOrder(true)}
              disabled={creating || !cart.length}
              label="Save as draft"
            />
          </View>
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, padding: 14,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 10 },
  payBtn: { flex: 1, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryRow: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  categoryPill: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  productCard: { width: '48%', borderWidth: 1, padding: 12, gap: 4 },
});
