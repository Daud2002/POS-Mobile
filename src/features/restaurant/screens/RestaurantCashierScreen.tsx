import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Printer, Receipt, Ban, Plus, Minus, BadgeCheck, Pencil, Save, Undo2,
} from 'lucide-react-native';

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
import {
  DEFAULT_DELIVERY_CHARGE,
  discountTextOf,
  orderTotal,
  parseChargeInput,
  parseDiscountInput,
  previewDiscount,
} from '@/lib/discount';
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
import type { Decimal, RestaurantOrder, RestaurantOrderItem } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { CustomerSuggestions } from '../components/CustomerSuggestions';

/** How the money can arrive. 'partial' opens the split editor. */
const PAYMENT_METHODS = ['cash', 'card', 'online', 'partial'] as const;

type NewOrderType = 'takeaway' | 'delivery';

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

interface MenuProduct {
  id: string;
  name: string;
  price: Decimal;
  categoryId?: string;
  image?: string | null;
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

/** Adds one of a product to a list of cart lines, merging onto an existing line. */
function appendLine(prev: CartLine[], product: MenuProduct, icon: string, skipKitchen: boolean): CartLine[] {
  const found = prev.find((l) => l.productId === product.id);
  if (found) {
    return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
  }
  return [...prev, {
    productId: product.id,
    name: product.name,
    // Resolved once, here: a cart line carries no category of its own.
    icon,
    price: toNumber(product.price),
    quantity: 1,
    skipKitchen,
  }];
}

function bumpLine(prev: CartLine[], productId: string, delta: number): CartLine[] {
  return prev
    .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
    .filter((l) => l.quantity > 0);
}

/**
 * The till.
 *
 * A takeaway or delivery is BILLED AS IT IS PUNCHED: the cashier enters the
 * discount (and, on a delivery, the charge) alongside the dishes, and one
 * button sends it to the kitchen and prints the bill. The money is booked
 * only when the cashier marks it paid, once the kitchen has handed it over.
 * Printing claims the order for this till — from then on no other cashier
 * sees it — so two counters cannot both collect for it.
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
  const [deliveryChargeText, setDeliveryChargeText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  /** The three boxes of a split payment, as typed. */
  const [split, setSplit] = useState<SplitText>(EMPTY_SPLIT_TEXT);
  const [printing, setPrinting] = useState(false);
  const [settling, setSettling] = useState(false);

  /**
   * Editing the lines of the selected order. Removals are staged per line
   * (how many to take off); additions are their own cart. Nothing is sent
   * until "Save & reprint".
   */
  const [editing, setEditing] = useState(false);
  const [removals, setRemovals] = useState<Record<string, number>>({});
  const [additions, setAdditions] = useState<CartLine[]>([]);
  const [saving, setSaving] = useState(false);

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
  const [orderType, setOrderType] = useState<NewOrderType>('takeaway');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  /**
   * Which customer field has focus, so the suggestion list searches on what
   * is being typed there. Null when none does, which hides the list.
   */
  const [customerField, setCustomerField] = useState<'name' | 'phone' | 'address' | null>(null);
  /**
   * Hides the list a beat after the field blurs, so a tap on a suggestion
   * lands before the list it was on disappears.
   */
  const blurCustomerField = (field: 'name' | 'phone' | 'address') => {
    setTimeout(() => setCustomerField((f) => (f === field ? null : f)), 150);
  };
  const [composerDiscount, setComposerDiscount] = useState('');
  const [composerCharge, setComposerCharge] = useState(String(DEFAULT_DELIVERY_CHARGE));
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
      RealtimeEvents.orderItemsRemoved,
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

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  /** A dish with no icon of its own borrows its category's. */
  const iconOf = (product: { categoryId?: string; image?: string | null }) =>
    iconFor(product, product.categoryId ? categoryById.get(product.categoryId) : null);

  const lineFor = (prev: CartLine[], product: MenuProduct) =>
    appendLine(
      prev,
      product,
      iconOf(product),
      categorySkipsKitchen(product.categoryId ? categoryById.get(product.categoryId) : null),
    );

  const setNotesOn =
    (setLines: (update: (prev: CartLine[]) => CartLine[]) => void) =>
    (productId: string, notes: string) =>
      setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, notes } : l)));

  // -------------------------------------------------------------- compose

  const cartSubtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const cartDiscount = previewDiscount(composerDiscount, cartSubtotal);
  const cartCharge = orderType === 'delivery' ? parseChargeInput(composerCharge) : 0;
  const cartTotal = orderTotal(cartSubtotal, cartDiscount, cartCharge, orderType);
  /** Drinks alone never reach the kitchen, and the button should say so. */
  const cartNeedsKitchen = cart.some((l) => !l.skipKitchen);

  const resetComposer = () => {
    setComposerOpen(false);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setCustomerField(null);
    setComposerDiscount('');
    setComposerCharge(String(DEFAULT_DELIVERY_CHARGE));
  };

  /**
   * Sends the order — with its discount and charge — and, unless it is a
   * draft, has the server record the bill as printed so it can be printed
   * here from the server's figures. A draft is saved quietly.
   */
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
      const { discountType, discountValue } = parseDiscountInput(composerDiscount);
      const order = await restaurantApi.createOrder({
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
        discountType: discountType ?? undefined,
        discountValue: discountValue ?? undefined,
        deliveryCharge: orderType === 'delivery' ? parseChargeInput(composerCharge) : undefined,
        printBill: !asDraft,
      });
      toast.success(
        asDraft
          ? 'Draft saved'
          : cartNeedsKitchen
            ? 'Order sent to kitchen — printing the bill'
            : 'Order placed — printing the bill',
      );
      resetComposer();
      refresh();
      if (!asDraft && hasPrinter) {
        const result = await printReceipt(
          receiptFromRestaurantOrder({ order, store: storeQuery.data, currency }),
        );
        if (!result.ok) toast.error(result.error ?? 'Receipt printing failed');
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  // ------------------------------------------------------------- checkout

  const billPrinted = !!selected?.billPrinted;
  const isDelivery = selected?.orderType === 'delivery';

  /**
   * What the bill will say once the staged edits are saved: the existing
   * lines less whatever is marked for removal, plus the additions. With
   * nothing staged this is simply the order as stored.
   */
  const previewSubtotal = useMemo(() => {
    const kept = (selected?.items ?? []).reduce((sum, i) => {
      const left = Math.max(toNumber(i.quantity) - (removals[i.id] ?? 0), 0);
      return sum + toNumber(i.unitPrice) * left;
    }, 0);
    const added = additions.reduce((sum, l) => sum + l.price * l.quantity, 0);
    return kept + added;
  }, [selected, removals, additions]);

  const discountPreview = useMemo(
    () => previewDiscount(discountText, previewSubtotal),
    [discountText, previewSubtotal],
  );
  const chargePreview = isDelivery ? parseChargeInput(deliveryChargeText) : 0;
  const billTotal = orderTotal(previewSubtotal, discountPreview, chargePreview, selected?.orderType);

  const hasItemChanges = additions.length > 0 || Object.values(removals).some((q) => q > 0);
  const remainingCount = (selected?.items ?? []).reduce(
    (n, i) => n + Math.max(toNumber(i.quantity) - (removals[i.id] ?? 0), 0),
    0,
  );

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

  const discardEdits = () => {
    setEditing(false);
    setRemovals({});
    setAdditions([]);
  };

  const openOrder = (order: RestaurantOrder) => {
    setSelected(order);
    // The boxes show what the order already carries, printed or not.
    setDiscountText(discountTextOf(order));
    setDeliveryChargeText(
      order.orderType === 'delivery' ? String(toNumber(order.deliveryCharge)) : '',
    );
    setPaymentMethod('cash');
    setSplit(EMPTY_SPLIT_TEXT);
    discardEdits();
  };

  const closeOrder = () => {
    setSelected(null);
    setDiscountText('');
    setDeliveryChargeText('');
    setSplit(EMPTY_SPLIT_TEXT);
    discardEdits();
  };

  const canEdit =
    !!selected && selected.orderStatus !== 'draft' && !printing && !settling && !saving;

  /** What the till sends the server for the money boxes as they stand. */
  const billFigures = (type: string | null | undefined) => {
    const { discountType, discountValue } = parseDiscountInput(discountText);
    return {
      // null clears a discount the cashier blanked out; the server keeps the
      // stored one only when the field is absent altogether.
      discountType: discountType ?? null,
      discountValue: discountValue ?? null,
      deliveryCharge: type === 'delivery' ? parseChargeInput(deliveryChargeText) : undefined,
    };
  };

  const printPaper = async (order: RestaurantOrder) => {
    // Print from the SERVER's numbers, never the local preview, so paper
    // always matches what was stored.
    if (!hasPrinter) return;
    const result = await printReceipt(
      receiptFromRestaurantOrder({ order, store: storeQuery.data, currency }),
    );
    if (!result.ok) toast.error(result.error ?? 'Receipt printing failed');
  };

  /**
   * Prints, or reprints, the bill with the discount and charge as they stand
   * in the boxes. The server fixes the figures and claims the order for this
   * cashier; the paper is printed from what it returns.
   */
  const printBill = async () => {
    if (!selected) return;
    setPrinting(true);
    try {
      const bill = await restaurantApi.printBill(selected.id, billFigures(selected.orderType));
      await printPaper(bill);
      toast.success(billPrinted ? 'Bill reprinted' : 'Bill printed — mark it paid once the money is in');
      setSelected(bill);
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to print the bill');
    } finally {
      setPrinting(false);
    }
  };

  /** Marks one more of an existing line for removal, up to the whole line. */
  const removeOne = (item: RestaurantOrderItem) => {
    setEditing(true);
    setRemovals((prev) => ({
      ...prev,
      [item.id]: Math.min((prev[item.id] ?? 0) + 1, toNumber(item.quantity)),
    }));
  };

  const restoreOne = (item: RestaurantOrderItem) =>
    setRemovals((prev) => ({ ...prev, [item.id]: Math.max((prev[item.id] ?? 0) - 1, 0) }));

  /**
   * Sends the staged edits, then reprints. Additions go first so an order
   * can have every original line replaced — the server refuses a removal
   * that would leave nothing, and it sees the additions before it does.
   *
   * The selected order may be swapped for a fresh copy mid-sequence (each
   * step raises order:updated and the list refetches), which is why the id
   * and the staged data are captured up front rather than read from state.
   */
  const saveEdits = async () => {
    if (!selected || !hasItemChanges) return;
    if (remainingCount === 0 && additions.length === 0) {
      toast.error('That would leave nothing on the order — cancel it instead');
      return;
    }
    const id = selected.id;
    const type = selected.orderType;
    const toAdd = additions.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      notes: l.notes?.trim() || undefined,
    }));
    const toRemove = Object.entries(removals)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

    setSaving(true);
    let persisted = false;
    try {
      if (toAdd.length) {
        await restaurantApi.addItems(id, toAdd);
        persisted = true;
      }
      if (toRemove.length) {
        await restaurantApi.removeItems(id, toRemove);
        persisted = true;
      }
      const bill = await restaurantApi.printBill(id, billFigures(type));
      discardEdits();
      setSelected(bill);
      refresh();
      await printPaper(bill);
      toast.success('Order updated — bill reprinted');
    } catch (error: any) {
      if (persisted) {
        // The order changed on the server; only the paper is missing.
        toast.error(
          `Changes saved, but the bill did not reprint: ${error?.message ?? 'unknown error'}. Tap Reprint bill.`,
        );
        discardEdits();
        refresh();
      } else {
        toast.error(error?.message ?? 'Failed to update the order');
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * Step two: the money. Charges exactly what was printed.
   *
   * Deliberately prints NOTHING. The customer already holds the bill — it
   * came out when the order was punched, or on the last reprint — and a
   * second slip at payment time is paper nobody asked for.
   */
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
      closeOrder();
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
      closeOrder();
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

  /**
   * The menu: search, category chips and the dish grid. Used by the composer
   * and by the checkout sheet's edit mode, so a dish is picked the same way
   * whether it starts an order or joins one.
   */
  const renderMenu = (onPick: (product: MenuProduct) => void) => (
    <>
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
            onPress={() => onPick(product as MenuProduct)}
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
    </>
  );

  /** Per-line qty/notes controls, shared by the cart and the additions list. */
  const renderCartLines = (
    lines: CartLine[],
    setLines: (update: (prev: CartLine[]) => CartLine[]) => void,
  ) =>
    lines.map((line) => (
      <View key={line.productId} style={{ gap: theme.spacing.xs }}>
        <View style={styles.itemRow}>
          <Text style={{ fontSize: 16, lineHeight: 22 }}>{line.icon}</Text>
          <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{line.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => setLines((prev) => bumpLine(prev, line.productId, -1))} hitSlop={8}>
              <Minus size={14} color={theme.colors.foreground} />
            </Pressable>
            <Text variant="bodySemibold">{line.quantity}</Text>
            <Pressable onPress={() => setLines((prev) => bumpLine(prev, line.productId, 1))} hitSlop={8}>
              <Plus size={14} color={theme.colors.foreground} />
            </Pressable>
          </View>
        </View>
        {/* Per-line kitchen note, exactly as the waiter screen offers — it
            prints on the kitchen ticket. Drinks never reach the kitchen, so
            they take none. */}
        {!line.skipKitchen && (
          <Input
            value={line.notes ?? ''}
            onChangeText={(text) => setNotesOn(setLines)(line.productId, text)}
            placeholder="Note for kitchen…"
          />
        )}
      </View>
    ));

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
        onClose={closeOrder}
        title={selected ? orderDestination(selected) : ''}
        description={
          selected
            ? `${orderLabel(selected)} · ${orderStatusLabel(orderDisplayStatus(selected))}${
                toNumber(selected.reprintCount) > 0 ? ` · reprinted ×${toNumber(selected.reprintCount)}` : ''
              }`
            : undefined
        }
        footer={
          selected ? (
            editing ? (
              <View style={{ flex: 1, gap: theme.spacing.sm }}>
                <Button
                  onPress={saveEdits}
                  loading={saving}
                  disabled={!hasItemChanges}
                  icon={<Save size={16} color={theme.colors.primaryForeground} />}
                  label="Save & reprint bill"
                />
                <Button
                  variant="outline"
                  onPress={discardEdits}
                  disabled={saving}
                  icon={<Undo2 size={16} color={theme.colors.foreground} />}
                  label="Discard changes"
                />
              </View>
            ) : (
              /*
                Print (or reprint) first — the customer gets the paper; then
                Mark as paid, once the money is actually in the drawer.
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
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <Button
                    variant="outline"
                    onPress={() => setEditing(true)}
                    disabled={!canEdit}
                    icon={<Pencil size={16} color={theme.colors.foreground} />}
                    label="Edit items"
                  />
                  <Button
                    variant="outline"
                    onPress={cancel}
                    disabled={printing || settling}
                    icon={<Ban size={16} color={theme.colors.destructive} />}
                    label="Cancel order"
                  />
                </View>
              </View>
            )
          ) : undefined
        }
      >
        {selected && (
          <>
            {/* The claim, spelled out: this bill is now this till's. */}
            {billPrinted && !editing && (
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
            {editing && (
              <View
                style={[
                  styles.notice,
                  { backgroundColor: tint(theme.colors.warning, 0.12), borderRadius: theme.radius.md },
                ]}
              >
                <Pencil size={16} color={theme.colors.warning} />
                <Text variant="caption" style={{ flex: 1 }}>
                  Editing. Use − to strike lines off and pick dishes below to add them. Nothing
                  changes until you save, and the bill reprints when you do.
                </Text>
              </View>
            )}

            <View style={{ gap: theme.spacing.xs }}>
              {(selected.items ?? []).map((item) => {
                const removing = removals[item.id] ?? 0;
                const left = Math.max(toNumber(item.quantity) - removing, 0);
                return (
                  <View key={item.id} style={styles.itemRow}>
                    <Text
                      variant="body"
                      style={[
                        { flex: 1 },
                        left === 0 ? { textDecorationLine: 'line-through', color: theme.colors.mutedForeground } : null,
                      ]}
                      numberOfLines={2}
                    >
                      {left} × {item.productName}
                      {removing > 0 && left > 0 ? (
                        <Text variant="caption" style={{ color: theme.colors.destructive }}>
                          {'  '}(−{removing})
                        </Text>
                      ) : null}
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
                    {canEdit && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Pressable
                          onPress={() => removeOne(item)}
                          disabled={left === 0}
                          hitSlop={8}
                          style={{ opacity: left === 0 ? 0.4 : 1 }}
                        >
                          <Minus size={14} color={theme.colors.destructive} />
                        </Pressable>
                        {removing > 0 && (
                          <Pressable onPress={() => restoreOne(item)} hitSlop={8}>
                            <Plus size={14} color={theme.colors.foreground} />
                          </Pressable>
                        )}
                      </View>
                    )}
                    <Text variant="body" style={{ minWidth: 64, textAlign: 'right' }}>
                      {format(toNumber(item.unitPrice) * left)}
                    </Text>
                  </View>
                );
              })}

              {additions.length > 0 && (
                <View style={[styles.totals, { borderColor: theme.colors.border, gap: theme.spacing.sm }]}>
                  <Text variant="caption" color="mutedForeground" style={{ textTransform: 'uppercase' }}>
                    Adding
                  </Text>
                  {renderCartLines(additions, setAdditions)}
                </View>
              )}
            </View>

            <View style={[styles.totals, { borderColor: theme.colors.border }]}>
              <View style={styles.itemRow}>
                <Text variant="caption" color="mutedForeground">Subtotal</Text>
                <Text variant="body">{format(previewSubtotal)}</Text>
              </View>
              {discountPreview > 0 && (
                <View style={styles.itemRow}>
                  <Text variant="caption" style={{ color: theme.colors.destructive }}>Discount</Text>
                  <Text variant="body" style={{ color: theme.colors.destructive }}>
                    -{format(discountPreview)}
                  </Text>
                </View>
              )}
              {isDelivery && chargePreview > 0 && (
                <View style={styles.itemRow}>
                  <Text variant="caption" color="mutedForeground">Delivery charges</Text>
                  <Text variant="body">{format(chargePreview)}</Text>
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
              editable={selected.orderStatus !== 'draft'}
              hint="Type 250 for a flat amount off, or 25% for a quarter off. Reprinting applies whatever is in the boxes."
            />

            {isDelivery && (
              <Input
                label="Delivery charge"
                value={deliveryChargeText}
                onChangeText={setDeliveryChargeText}
                placeholder={String(DEFAULT_DELIVERY_CHARGE)}
                keyboardType="decimal-pad"
                hint="Added on top of the discounted order. Clear it for a free delivery."
              />
            )}

            {editing && (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="caption" color="mutedForeground" style={{ textTransform: 'uppercase' }}>
                  Add dishes
                </Text>
                {renderMenu((product) => setAdditions((prev) => lineFor(prev, product)))}
              </View>
            )}

            {billPrinted && !editing && (
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
            {!billPrinted && selected.orderStatus !== 'draft' && !editing && (
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
            {selected.tableName && billPrinted && !editing ? (
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
              icon={<Printer size={16} color={theme.colors.primaryForeground} />}
              label={cartNeedsKitchen ? 'Send to kitchen & print bill' : 'Place order & print bill'}
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
          {/* The directory, above the fields, as the cashier types into any of them. */}
          <CustomerSuggestions
            visible={customerField !== null}
            query={
              customerField === 'name'
                ? customerName
                : customerField === 'phone'
                  ? customerPhone
                  : customerField === 'address'
                    ? deliveryAddress
                    : ''
            }
            onSelect={(customer) => {
              setCustomerName(customer.name);
              setCustomerPhone(customer.phone);
              if (customer.address) setDeliveryAddress(customer.address);
              setCustomerField(null);
            }}
          />
          <Input
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Customer name"
            onFocus={() => setCustomerField('name')}
            onBlur={() => blurCustomerField('name')}
            autoComplete="off"
          />
          <Input
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="Phone"
            keyboardType="phone-pad"
            onFocus={() => setCustomerField('phone')}
            onBlur={() => blurCustomerField('phone')}
            autoComplete="off"
          />
          {orderType === 'delivery' && (
            <Input
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder="Delivery address (required)"
              onFocus={() => setCustomerField('address')}
              onBlur={() => blurCustomerField('address')}
              autoComplete="off"
            />
          )}
          {/* The bill prints as the order is sent, so its figures are set here. */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Input
              containerStyle={{ flex: 1 }}
              label="Discount"
              value={composerDiscount}
              onChangeText={setComposerDiscount}
              placeholder="250 or 25%"
              autoCapitalize="none"
            />
            {orderType === 'delivery' && (
              <Input
                containerStyle={{ flex: 1 }}
                label="Delivery charge"
                value={composerCharge}
                onChangeText={setComposerCharge}
                placeholder={String(DEFAULT_DELIVERY_CHARGE)}
                keyboardType="decimal-pad"
              />
            )}
          </View>
        </View>

        {renderMenu((product) => setCart((prev) => lineFor(prev, product)))}

        {cart.length > 0 && (
          <View style={[styles.totals, { borderColor: theme.colors.border, gap: theme.spacing.sm }]}>
            {renderCartLines(cart, setCart)}
            <View style={styles.itemRow}>
              <Text variant="caption" color="mutedForeground">Subtotal</Text>
              <Text variant="body">{format(cartSubtotal)}</Text>
            </View>
            {cartDiscount > 0 && (
              <View style={styles.itemRow}>
                <Text variant="caption" style={{ color: theme.colors.destructive }}>Discount</Text>
                <Text variant="body" style={{ color: theme.colors.destructive }}>-{format(cartDiscount)}</Text>
              </View>
            )}
            {orderType === 'delivery' && cartCharge > 0 && (
              <View style={styles.itemRow}>
                <Text variant="caption" color="mutedForeground">Delivery charges</Text>
                <Text variant="body">{format(cartCharge)}</Text>
              </View>
            )}
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
