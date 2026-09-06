import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Receipt, Ban, Plus, Minus, BadgeCheck, Bike } from 'lucide-react-native';

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
import { categorySkipsKitchen } from '@/lib/kitchen';
import {
  orderDestination,
  orderDisplayStatus,
  orderLabel,
  orderStatusLabel,
} from '@/lib/orderLabel';
import { parseDiscountInput, previewDiscount } from '@/lib/discount';
import {
  EMPTY_SPLIT_TEXT,
  SPLIT_METHODS,
  isSplitBalanced,
  parseSplit,
  paymentMethodLabel,
  splitRemaining,
  type SplitMethod,
  type SplitText,
} from '@/lib/payment';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { receiptFromRestaurantOrder } from '@/features/printing/templates/receiptFromOrder';
import { tint, useTheme } from '@/theme';
import type { Decimal, RestaurantOrder } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { ConnectionBanner } from '../components/ConnectionBanner';

/** How the money can arrive. 'partial' opens the split editor. */
const PAYMENT_METHODS = ['cash', 'card', 'online', 'partial'] as const;

interface CartLine {
  productId: string;
  name: string;
  icon: string;
  price: number;
  quantity: number;
  /** Kitchen instruction for this line, printed on the ticket. */
  notes?: string;
  /** Served from the counter, not cooked. Decided by the category. */
  skipKitchen: boolean;
}

/**
 * Open orders, most-ready first.
 *
 * A bill that is already printed is the one this cashier is mid-way through:
 * the customer is waiting with the paper. Then the handed-over orders, whose
 * food is out. Sinking either below tickets the kitchen has not started is
 * backwards for the person holding the card machine.
 */
const STATUS_PRIORITY: Record<string, number> = {
  bill_printed: 0,
  handed_over: 1,
  preparing: 2,
  requested: 3,
  draft: 4,
};

/** What the discount box shows for a bill whose figure is already fixed. */
function discountTextOf(order: RestaurantOrder): string {
  if (!order.billPrinted || !order.discountType) return '';
  return order.discountType === 'percent'
    ? `${toNumber(order.discountValue)}%`
    : String(toNumber(order.discountValue));
}

/**
 * The till.
 *
 * Checking out is TWO steps, the way a restaurant actually works: the bill is
 * printed first and taken to the customer; the money is booked only when the
 * cashier marks it paid. Printing claims the order for this till — from then
 * on no other cashier sees it — so two counters cannot both collect for it.
 */
export function RestaurantCashierScreen() {
  const theme = useTheme();
  const toast = useToast();
  const storeId = useStoreId();
  const { user } = useAuth();
  const { format, currency } = useStoreCurrency();
  const queryClient = useQueryClient();
  const { printReceipt, hasPrinter } = usePrinter();

  const [selected, setSelected] = useState<RestaurantOrder | null>(null);
  const [discountText, setDiscountText] = useState('');
  const [riderName, setRiderName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  /** The three boxes of a split payment, as typed. */
  const [split, setSplit] = useState<SplitText>(EMPTY_SPLIT_TEXT);
  const [printing, setPrinting] = useState(false);
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
  const shiftBlocked = !!user?.shiftsEnabled && !shift;

  // Takeaway / delivery composer — the cashier's own order entry.
  const [composerOpen, setComposerOpen] = useState(false);
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [creating, setCreating] = useState(false);

  const ordersQuery = useQuery({
    queryKey: queryKeys.restaurantOrders('open'),
    queryFn: () =>
      restaurantApi
        // The server already omits bills other cashiers have printed.
        .listOrders({ orderStatus: 'requested,preparing,handed_over,draft' })
        .then((rows) =>
          [...rows].sort(
            (a, b) =>
              (STATUS_PRIORITY[orderDisplayStatus(a)] ?? 9) -
              (STATUS_PRIORITY[orderDisplayStatus(b)] ?? 9),
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

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const allProducts = productsQuery.data ?? [];
  // The owner's menu order, the same one the web till shows.
  const categories = useMemo(
    () => sortBySortOrder(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  /**
   * Keep the open bill in sync when a waiter adds a round to it — and close
   * it if it has left this till's list, which happens when another cashier
   * prints it first or a waiter's round releases this cashier's claim.
   */
  useEffect(() => {
    if (!selected) return;
    const fresh = orders.find((o) => o.id === selected.id);
    if (fresh) {
      setSelected(fresh);
    } else if (!ordersQuery.isLoading) {
      setSelected(null);
    }
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

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
  /** Drinks alone never reach the kitchen, and the button should say so. */
  const cartNeedsKitchen = cart.some((l) => !l.skipKitchen);

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
        skipKitchen: categorySkipsKitchen(
          product.categoryId ? categoryById.get(product.categoryId) : null,
        ),
      }];
    });

  const changeQty = (productId: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );

  const setNotes = (productId: string, notes: string) =>
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, notes } : l)));

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
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          notes: l.notes?.trim() || undefined,
        })),
        isDraft: asDraft,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
      });
      toast.success(
        asDraft
          ? 'Draft saved'
          : cartNeedsKitchen
            ? 'Order sent to kitchen'
            : 'Order placed — nothing for the kitchen',
      );
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

  // ------------------------------------------------------------- checkout

  const subtotal = useMemo(
    () => (selected?.items ?? []).reduce((sum, i) => sum + toNumber(i.total), 0),
    [selected],
  );
  const billPrinted = !!selected?.billPrinted;
  /**
   * Before printing, the discount box drives the preview. After printing the
   * figure is FIXED — it is what the customer is holding — so the stored one
   * is shown and the box is locked; reprinting is how it changes.
   */
  const discountPreview = useMemo(
    () => (billPrinted ? toNumber(selected?.discount) : previewDiscount(discountText, subtotal)),
    [billPrinted, selected?.discount, discountText, subtotal],
  );
  const billTotal = Math.max(subtotal - discountPreview, 0);

  /**
   * A split payment must account for every rupee before it can be taken —
   * the server refuses one that does not balance, so the till says where the
   * cashier stands as they type.
   */
  const parsedSplit = useMemo(() => parseSplit(split), [split]);
  const splitLeft = splitRemaining(billTotal, parsedSplit);
  const splitBalanced = isSplitBalanced(billTotal, parsedSplit);
  const isPartial = paymentMethod === 'partial';

  /** Drops whatever is still unallocated into one box. */
  const fillRemaining = (method: SplitMethod) => {
    if (splitLeft <= 0) return;
    setSplit((s) => ({
      ...s,
      [method]: String(Math.round((parsedSplit[method] + splitLeft) * 100) / 100),
    }));
  };

  const openOrder = (order: RestaurantOrder) => {
    setSelected(order);
    setDiscountText(discountTextOf(order));
    setRiderName(order.riderName ?? '');
    setPaymentMethod('cash');
    setSplit(EMPTY_SPLIT_TEXT);
  };

  /**
   * Step one. The server fixes the discount, records the rider and claims
   * the order for this cashier; the paper is printed from what it returns.
   */
  const printBill = async () => {
    if (!selected) return;
    if (selected.orderType === 'delivery' && !riderName.trim()) {
      toast.error("Enter the rider's name — it is printed on the bill");
      return;
    }
    setPrinting(true);
    try {
      const { discountType, discountValue } = parseDiscountInput(discountText);
      const bill = await restaurantApi.printBill(selected.id, {
        discountType: discountType ?? undefined,
        discountValue: discountValue ?? undefined,
        riderName: riderName.trim() || undefined,
      });

      // Print from the SERVER's numbers, never the local preview, so paper
      // always matches what was stored.
      if (hasPrinter) {
        const result = await printReceipt(
          receiptFromRestaurantOrder({ order: bill, store: storeQuery.data, currency }),
        );
        if (!result.ok) toast.error(result.error ?? 'Receipt printing failed');
      }

      toast.success(billPrinted ? 'Bill reprinted' : 'Bill printed — mark it paid once the money is in');
      setSelected(bill);
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to print the bill');
    } finally {
      setPrinting(false);
    }
  };

  /** Step two: the money. Charges exactly what was printed. */
  const markPaid = async () => {
    if (!selected) return;
    if (isPartial && !splitBalanced) {
      toast.error('The split has to add up to the bill before it can be taken');
      return;
    }
    setSettling(true);
    try {
      await restaurantApi.settle(
        selected.id,
        isPartial ? { paymentMethod, split: parsedSplit } : { paymentMethod },
      );
      toast.success(selected.tableName ? `Paid — ${selected.tableName} is now free` : 'Paid');
      setSelected(null);
      setDiscountText('');
      setSplit(EMPTY_SPLIT_TEXT);
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to mark the order paid');
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

  /** A pill row shared by the payment and order-type choices. */
  const pill = (active: boolean) => [
    styles.pill,
    {
      borderRadius: theme.radius.md,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active ? tint(theme.colors.primary, 0.1) : 'transparent',
    },
  ];

  return (
    <Screen scrollable refreshing={ordersQuery.isRefetching} onRefresh={refresh}>
      <View style={{ gap: theme.spacing.md }}>
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
            description="Orders sent by waiters appear here. Bills printed at another till are not shown."
          />
        ) : (
          orders.map((order) => (
            <Pressable
              key={order.id}
              onPress={() => openOrder(order)}
              style={[
                styles.row,
                {
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.card,
                  borderColor: order.billPrinted ? tint(theme.colors.success, 0.6) : theme.colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodySemibold" numberOfLines={1}>
                  {orderDestination(order)}
                  {order.customerName ? ` · ${order.customerName}` : ''}
                  {/* This till already printed it — the customer is waiting
                      with the paper. Otherwise, the kitchen being done is
                      the cue to reach for it next. */}
                  {order.billPrinted ? (
                    <Text variant="caption" style={{ color: theme.colors.success }}>
                      {'  '}Bill printed
                    </Text>
                  ) : order.orderStatus === 'handed_over' ? (
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

      {/* ------------------------------------------------- checkout sheet */}
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? orderDestination(selected) : ''}
        description={
          selected
            ? `${orderLabel(selected)} · ${orderStatusLabel(orderDisplayStatus(selected))}`
            : undefined
        }
        footer={
          selected ? (
            /*
              Two buttons for two moments. Print first — the customer gets
              the paper; then Mark as paid, once the money is actually in the
              drawer. Reprinting after a change is the same button.
            */
            <View style={{ flex: 1, gap: theme.spacing.sm }}>
              <Button
                variant={billPrinted ? 'outline' : 'primary'}
                onPress={printBill}
                loading={printing}
                disabled={settling || selected.orderStatus === 'draft'}
                icon={
                  <Printer
                    size={16}
                    color={billPrinted ? theme.colors.foreground : theme.colors.primaryForeground}
                  />
                }
                label={billPrinted ? 'Reprint bill' : 'Print bill'}
              />
              <Button
                onPress={markPaid}
                loading={settling}
                disabled={
                  printing ||
                  !billPrinted ||
                  (isPartial && !splitBalanced) ||
                  // The server rejects this too; disabling here is only so the
                  // cashier is told why before they try.
                  shiftBlocked
                }
                icon={<BadgeCheck size={16} color={theme.colors.primaryForeground} />}
                label="Mark as paid"
              />
              <Button
                variant="outline"
                onPress={cancel}
                disabled={printing || settling}
                icon={<Ban size={16} color={theme.colors.destructive} />}
                label="Cancel order"
              />
            </View>
          ) : undefined
        }
      >
        {selected && (
          <>
            {/* The claim, spelled out: this bill is now this till's. */}
            {billPrinted && (
              <View
                style={[
                  styles.notice,
                  { backgroundColor: tint(theme.colors.success, 0.12), borderRadius: theme.radius.md },
                ]}
              >
                <BadgeCheck size={16} color={theme.colors.success} />
                <Text variant="caption" style={{ flex: 1 }}>
                  Bill printed
                  {selected.billPrintedByName ? ` by ${selected.billPrintedByName}` : ''}. Mark it
                  paid once the money is in.
                </Text>
              </View>
            )}

            <View style={{ gap: theme.spacing.xs }}>
              {(selected.items ?? []).map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={2}>
                    {item.quantity} × {item.productName}
                    {item.isParcel ? (
                      <Text variant="caption" style={{ color: theme.colors.info }}>
                        {'  '}(parcel)
                      </Text>
                    ) : null}
                    {item.notes ? (
                      <Text variant="caption" style={{ color: theme.colors.warning }}>
                        {'  '}— {item.notes}
                      </Text>
                    ) : null}
                  </Text>
                  <Text variant="body">{format(toNumber(item.total))}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.totals, { borderColor: theme.colors.border }]}>
              <View style={styles.itemRow}>
                <Text variant="caption" color="mutedForeground">Subtotal</Text>
                <Text variant="body">{format(subtotal)}</Text>
              </View>
              {discountPreview > 0 && (
                <View style={styles.itemRow}>
                  <Text variant="caption" style={{ color: theme.colors.destructive }}>
                    Discount
                    {billPrinted && selected.discountType === 'percent' && selected.discountValue
                      ? ` (${toNumber(selected.discountValue)}%)`
                      : ''}
                  </Text>
                  <Text variant="body" style={{ color: theme.colors.destructive }}>
                    -{format(discountPreview)}
                  </Text>
                </View>
              )}
              <View style={styles.itemRow}>
                <Text variant="bodySemibold">Total</Text>
                <Text variant="bodySemibold">{format(billTotal)}</Text>
              </View>
            </View>

            <Input
              label="Discount"
              value={discountText}
              onChangeText={setDiscountText}
              placeholder="250 or 25%"
              autoCapitalize="none"
              editable={!billPrinted}
              hint={
                billPrinted
                  ? 'Fixed when the bill was printed. Reprint the bill to change it.'
                  : 'Type 250 for a flat amount off, or 25% for a quarter off the order.'
              }
            />

            {/* A delivery bill names its rider, so it is asked for here. */}
            {selected.orderType === 'delivery' && (
              <Input
                label="Rider"
                value={riderName}
                onChangeText={setRiderName}
                placeholder="Who is delivering this order?"
                leading={<Bike size={16} color={theme.colors.mutedForeground} />}
                hint="Printed on the bill the rider takes with them."
              />
            )}

            {billPrinted && (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="caption">Paid by</Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  {PAYMENT_METHODS.map((method) => (
                    <Pressable
                      key={method}
                      onPress={() => setPaymentMethod(method)}
                      style={pill(paymentMethod === method)}
                    >
                      <Text variant="caption">{paymentMethodLabel(method)}</Text>
                    </Pressable>
                  ))}
                </View>

                {/*
                  A customer paying part by card and the rest in cash: the
                  cashier types each part, and the bill is only taken once the
                  parts add up. "Rest" drops whatever is left into that box,
                  which is how most splits end — one exact figure on the card,
                  the remainder in notes.
                */}
                {isPartial && (
                  <View
                    style={[
                      styles.splitBox,
                      { borderColor: theme.colors.border, borderRadius: theme.radius.md },
                    ]}
                  >
                    {SPLIT_METHODS.map((method) => (
                      <View key={method} style={styles.splitRow}>
                        <Text variant="caption" color="mutedForeground" style={{ width: 52 }}>
                          {paymentMethodLabel(method)}
                        </Text>
                        <Input
                          containerStyle={{ flex: 1 }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          value={split[method]}
                          onChangeText={(text) => setSplit((s) => ({ ...s, [method]: text }))}
                        />
                        <Pressable
                          onPress={() => fillRemaining(method)}
                          disabled={splitLeft <= 0}
                          hitSlop={8}
                          style={{ opacity: splitLeft <= 0 ? 0.4 : 1 }}
                        >
                          <Text variant="caption" style={{ color: theme.colors.primary }}>
                            Rest
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                    <View
                      style={[
                        styles.itemRow,
                        { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, paddingTop: theme.spacing.sm },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: splitBalanced
                            ? theme.colors.success
                            : splitLeft > 0
                              ? theme.colors.warning
                              : theme.colors.destructive,
                        }}
                      >
                        {splitBalanced
                          ? 'Adds up to the bill'
                          : splitLeft > 0
                            ? 'Still to allocate'
                            : 'Over the bill by'}
                      </Text>
                      <Text
                        variant="caption"
                        style={{
                          color: splitBalanced
                            ? theme.colors.success
                            : splitLeft > 0
                              ? theme.colors.warning
                              : theme.colors.destructive,
                        }}
                      >
                        {splitBalanced ? format(billTotal) : format(Math.abs(splitLeft))}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {selected.orderStatus === 'draft' && (
              <Text variant="caption" color="mutedForeground">
                This is still a draft. A waiter must send it to the kitchen first.
              </Text>
            )}
            {!billPrinted && selected.orderStatus !== 'draft' && (
              <Text variant="caption" color="mutedForeground">
                Print the bill first. Once it is printed, only this till can mark it paid.
                {!hasPrinter ? ' No printer is paired, so the bill is recorded without paper.' : ''}
              </Text>
            )}
            {shiftBlocked && billPrinted && (
              <Text variant="caption" style={{ color: theme.colors.warning }}>
                Open your shift on the My Shift tab first — payments have to be counted
                against a drawer.
              </Text>
            )}
            {selected.tableName && billPrinted ? (
              <Text variant="caption" color="mutedForeground">
                Marking it paid frees {selected.tableName} for the next customer.
              </Text>
            ) : null}
          </>
        )}
      </Sheet>

      {/* ------------------------------------------------- composer sheet */}
      <Sheet
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title={`New ${orderType} order`}
        footer={
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            <Button
              onPress={() => createOrder(false)}
              loading={creating}
              disabled={!cart.length}
              label={cartNeedsKitchen ? 'Send to kitchen' : 'Place order'}
            />
            <Button
              variant="outline"
              onPress={() => createOrder(true)}
              disabled={creating || !cart.length}
              label="Save as draft"
            />
            {cart.length > 0 && !cartNeedsKitchen && (
              <Text variant="caption" color="mutedForeground">
                Drinks only — nothing goes to the kitchen.
              </Text>
            )}
          </View>
        }
      >
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {(['takeaway', 'delivery'] as const).map((type) => (
            <Pressable key={type} onPress={() => setOrderType(type)} style={pill(orderType === type)}>
              <Text variant="caption" style={{ textTransform: 'capitalize' }}>{type}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Input value={customerName} onChangeText={setCustomerName} placeholder="Customer name" />
          <Input value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone" keyboardType="phone-pad" />
          {orderType === 'delivery' && (
            <Input
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder="Delivery address"
            />
          )}
        </View>

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
          <View style={[styles.totals, { borderColor: theme.colors.border, gap: theme.spacing.sm }]}>
            {cart.map((line) => (
              <View key={line.productId} style={{ gap: theme.spacing.xs }}>
                <View style={styles.itemRow}>
                  <Text style={{ fontSize: 16, lineHeight: 22 }}>{line.icon}</Text>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{line.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable onPress={() => changeQty(line.productId, -1)} hitSlop={8}>
                      <Minus size={14} color={theme.colors.foreground} />
                    </Pressable>
                    <Text variant="bodySemibold">{line.quantity}</Text>
                    <Pressable onPress={() => changeQty(line.productId, 1)} hitSlop={8}>
                      <Plus size={14} color={theme.colors.foreground} />
                    </Pressable>
                  </View>
                </View>
                {/* Per-line kitchen note, exactly as the waiter screen
                    offers — it prints on the kitchen ticket. Drinks never
                    reach the kitchen, so they take none. */}
                {!line.skipKitchen && (
                  <Input
                    value={line.notes ?? ''}
                    onChangeText={(text) => setNotes(line.productId, text)}
                    placeholder="Note for kitchen…"
                  />
                )}
              </View>
            ))}
            <View style={styles.itemRow}>
              <Text variant="bodySemibold">Total</Text>
              <Text variant="bodySemibold">{format(cartTotal)}</Text>
            </View>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, padding: 14,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  totals: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 4 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  pill: { flex: 1, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  splitBox: { borderWidth: 1, padding: 12, gap: 8 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryPill: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  productCard: { width: '48%', borderWidth: 1, padding: 12, gap: 4 },
});
