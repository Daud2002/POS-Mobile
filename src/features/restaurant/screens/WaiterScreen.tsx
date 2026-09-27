import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  Send,
  Save,
  X,
  Plus,
  Minus,
  ClipboardList,
  ChevronRight,
  ShoppingBag,
  Trash2,
} from 'lucide-react-native';

import { restaurantApi, productsApi, categoriesApi } from '@/api/services';
import { queryKeys } from '@/api/queryKeys';
import type { RestaurantTabParamList } from '@/app/navigation/types';
import { Screen } from '@/components/layout';
import { Button, ConfirmDialog, EmptyState, Input, Sheet, Text, useToast } from '@/components/ui';
import { categoryIcon, iconFor } from '@/constants/emojis';
import { useStoreId } from '@/hooks/useStoreId';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvents } from '@/lib/socket';
import { toNumber } from '@/lib/format';
import { categorySkipsKitchen } from '@/lib/kitchen';
import { orderDisplayStatus, orderStatusLabel } from '@/lib/orderLabel';
import { sortBySortOrder } from '@/lib/sortOrder';
import { tint, useTheme } from '@/theme';
import type { Category, Decimal, Product, RestaurantOrder, RestaurantTable } from '@/api/types';
import { ConnectionBanner } from '../components/ConnectionBanner';

interface CartLine {
  productId: string;
  name: string;
  /** Resolved when the line is created — see addToCart. */
  icon: string;
  price: number;
  quantity: number;
  notes?: string;
  /**
   * Pack this line to go as a parcel. Anything not marked is dine-in; the
   * waiter never picks an order type up front.
   */
  isParcel?: boolean;
  /** Served from the counter, not cooked — a drink. Never reaches the kitchen. */
  skipKitchen: boolean;
}

/**
 * Waiter order entry.
 *
 * Deliberately category-first: the menu runs to 160+ items across 19
 * categories, so a single flat grid is unusable on a phone. The waiter picks a
 * table, taps a category, adds items in a sheet, closes it, and repeats — then
 * reviews everything once before it goes to the kitchen. Only one category's
 * items are ever mounted, which also keeps the screen light.
 *
 * Dine-in versus parcel is not chosen per order: every line carries its own
 * toggle, and anything left unmarked is dine-in.
 */
export function WaiterScreen() {
  const theme = useTheme();
  const toast = useToast();
  const storeId = useStoreId();
  const { format } = useStoreCurrency();
  const queryClient = useQueryClient();
  const navigation = useNavigation<BottomTabNavigationProp<RestaurantTabParamList, 'Tables'>>();
  const route = useRoute<RouteProp<RestaurantTabParamList, 'Tables'>>();

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [appendTo, setAppendTo] = useState<RestaurantOrder | null>(null);
  const [editingDraft, setEditingDraft] = useState<RestaurantOrder | null>(null);
  /** The draft the waiter has asked to bin, pending confirmation. */
  const [discarding, setDiscarding] = useState<RestaurantOrder | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [openCategory, setOpenCategory] = useState<Category | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  /**
   * Picking a table is only half the job — the waiter then has to take the
   * order, and the menu sits below the table grid and the drafts list. On a
   * phone that is off-screen, so tapping a table jumps straight there instead
   * of leaving the waiter to scroll past everything they just finished with.
   */
  const scrollRef = useRef<ScrollView>(null);
  const menuY = useRef(0);

  const scrollToMenu = useCallback(() => {
    // A frame's delay: the drafts list may have just appeared or gone, which
    // moves the menu, and onLayout has to land before we can aim at it.
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: Math.max(menuY.current - 8, 0), animated: true }),
    );
  }, []);
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
    // handed_over included: the food is out but the table is still taken, so
    // the waiter must still be able to add a round to it.
    queryFn: () => restaurantApi.listOrders({ orderStatus: 'requested,preparing,handed_over' }),
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

  // Occupancy changes from other waiters and from the cashier settling, so
  // this has to be live or two waiters will fight over the same table.
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
  const liveOrders = useMemo(() => liveQuery.data ?? [], [liveQuery.data]);
  const allProducts = productsQuery.data ?? [];
  // The owner's menu order, the same one the web screens show.
  const categories = useMemo(
    () => sortBySortOrder(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  /**
   * Arriving from My Orders with an order in hand: open the menu as a new
   * round on it. The param is consumed straight away so that returning to
   * this tab later does not silently re-arm the same order.
   */
  const handoff = route.params?.appendToOrderId;
  useEffect(() => {
    if (!handoff) return;
    const order = liveOrders.find((o) => o.id === handoff);
    if (!order) return;
    setAppendTo(order);
    setEditingDraft(null);
    setSelectedTable(null);
    setCart([]);
    navigation.setParams({ appendToOrderId: undefined });
    scrollToMenu();
  }, [handoff, liveOrders, navigation, scrollToMenu]);

  /**
   * Products bucketed by category, so opening one is a lookup not a scan.
   * Bucketed from the sorted list, so each category's sheet opens in the
   * owner's menu order.
   */
  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of sortBySortOrder(allProducts)) {
      const key = product.categoryId ?? 'uncategorised';
      const bucket = map.get(key);
      if (bucket) bucket.push(product);
      else map.set(key, [product]);
    }
    return map;
  }, [allProducts]);

  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  /** A dish with no icon of its own borrows its category's. */
  const iconOf = (product: { categoryId?: string; image?: string | null }) =>
    iconFor(product, product.categoryId ? categoryById.get(product.categoryId) : null);

  const skipsKitchen = (product: { categoryId?: string }) =>
    categorySkipsKitchen(product.categoryId ? categoryById.get(product.categoryId) : null);

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
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          // Resolved once, here: a cart line carries no category of its own.
          icon: iconOf(product),
          price: toNumber(product.price),
          quantity: 1,
          skipKitchen: skipsKitchen(product),
        },
      ];
    });

  const changeQty = (productId: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );

  const qtyOf = (productId: string) =>
    cart.find((l) => l.productId === productId)?.quantity ?? 0;

  const reset = () => {
    setCart([]);
    setSelectedTable(null);
    setAppendTo(null);
    setEditingDraft(null);
    setReviewOpen(false);
    setOpenCategory(null);
  };

  /**
   * Dine-in or parcel is a fact about the lines, not a choice: anything not
   * marked parcel is eaten in. The server derives the same thing; this is
   * only so the request says what the waiter sees.
   */
  const hasParcel = cart.some((l) => l.isParcel);
  const allParcel = hasParcel && cart.every((l) => l.isParcel);
  const orderType = hasParcel ? 'dine_out' : 'dine_in';
  /** Nothing to cook — drinks only — so the button should not promise the kitchen. */
  const needsKitchen = cart.some((l) => !l.skipKitchen);

  const itemsPayload = () =>
    cart.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      notes: l.notes?.trim() || undefined,
      isParcel: !!l.isParcel,
    }));

  const toggleParcel = (productId: string) =>
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, isParcel: !l.isParcel } : l)),
    );

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
        // The kitchen gets a ticket with only these lines — and none at all
        // when the round is drinks alone.
        await restaurantApi.addItems(appendTo.id, itemsPayload());
        toast.success(
          appendTo.billPrinted
            ? `Added to ${appendTo.tableName ?? 'order'} — the cashier will reprint the bill`
            : `Added to ${appendTo.tableName ?? 'order'}`,
        );
      } else if (editingDraft) {
        await restaurantApi.updateDraft(editingDraft.id, {
          items: itemsPayload(),
          tableId: selectedTable?.id,
          version: editingDraft.version,
        });
        if (!asDraft) {
          await restaurantApi.punch(editingDraft.id, selectedTable?.id);
          toast.success(needsKitchen ? 'Order sent to kitchen' : 'Order placed — nothing for the kitchen');
        } else {
          toast.success('Draft saved');
        }
      } else {
        await restaurantApi.createOrder({
          orderType,
          tableId: selectedTable?.id,
          items: itemsPayload(),
          isDraft: asDraft,
        });
        toast.success(
          asDraft
            ? 'Draft saved'
            : needsKitchen
              ? 'Order sent to kitchen'
              : 'Order placed — nothing for the kitchen',
        );
      }
      reset();
      refresh();
    } catch (error: any) {
      // A 409 means another waiter claimed the table first. The cart survives
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
      (draft.items ?? []).map((item) => {
        const product = allProducts.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          name: item.productName,
          // Order lines snapshot a name only, so a reopened draft finds its
          // icon back through the live menu; a since-retired dish falls back.
          icon: iconOf(product ?? {}),
          price: toNumber(item.unitPrice),
          quantity: item.quantity,
          notes: item.notes ?? undefined,
          isParcel: !!item.isParcel,
          skipKitchen: item.skipKitchen ?? (product ? skipsKitchen(product) : false),
        };
      }),
    );
    setReviewOpen(true);
  };

  /** Bins a draft. If it was the one open in the review sheet, that clears too. */
  const discardDraft = async () => {
    if (!discarding) return;
    try {
      await restaurantApi.discardDraft(discarding.id);
      toast.success('Draft discarded');
      if (editingDraft?.id === discarding.id) reset();
      setDiscarding(null);
      refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not discard the draft');
    }
  };

  const destination = appendTo
    ? `Adding to ${appendTo.tableName ?? 'order'}`
    : selectedTable
      ? `Table: ${selectedTable.name}`
      : 'No table selected';

  return (
    <Screen
      scrollable
      refreshing={tablesQuery.isRefetching}
      onRefresh={refresh}
      scrollRef={scrollRef}
      /*
       * Docked so it stays reachable the moment there is something to review,
       * however far down the menu the waiter has scrolled. Rendered outside
       * the scroll area, so it cannot cover the last dishes in the list.
       * Hidden while the cart is empty — an always-visible disabled button
       * would just eat screen height on a phone.
       */
      footer={
        cart.length ? (
          <View style={styles.footerBar}>
            <Button
              style={{ flex: 1 }}
              onPress={() => setReviewOpen(true)}
              icon={<ClipboardList size={16} color={theme.colors.primaryForeground} />}
              label={`Review · ${cartCount} item${cartCount === 1 ? '' : 's'} · ${format(cartTotal)}`}
            />
            {/* Fixed-width neighbour, so the Review button keeps one width
                however long its item-count/total label grows. */}
            <Button
              variant="outline"
              onPress={reset}
              icon={<X size={16} color={theme.colors.mutedForeground} />}
              label="Clear"
            />
          </View>
        ) : null
      }
    >
      <View style={styles.stack}>
        <ConnectionBanner connected={connected} />

        {/* ---------------------------------------------------- tables */}
        <Text variant="h2">Tables</Text>
        <View style={styles.tableGrid}>
          {tables.map((table) => {
            const live = liveOrders.find((o) => o.tableId === table.id);
            const free = table.status === 'free';
            const selected = selectedTable?.id === table.id;
            const active = selected || appendTo?.tableId === table.id;
            return (
              <Pressable
                key={table.id}
                onPress={() => {
                  if (free) {
                    setAppendTo(null);
                    const next = selected ? null : table;
                    setSelectedTable(next);
                    // Deselecting should not yank the waiter down the page.
                    if (next) scrollToMenu();
                  } else if (live) {
                    // Occupied: this becomes an extra round on the open order.
                    setAppendTo(live);
                    setEditingDraft(null);
                    setSelectedTable(null);
                    scrollToMenu();
                  }
                }}
                style={[
                  styles.tableCard,
                  {
                    borderRadius: theme.radius.md,
                    borderColor: active
                      ? theme.colors.primary
                      : free
                        ? theme.colors.border
                        : tint(theme.colors.warning, 0.5),
                    backgroundColor: active
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
                  numberOfLines={1}
                  style={{ color: free ? theme.colors.success : theme.colors.warning }}
                >
                  {free ? 'Free' : live ? orderStatusLabel(orderDisplayStatus(live)) : 'Occupied'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {tables.length === 0 && !tablesQuery.isLoading && (
          <EmptyState title="No tables" description="The owner has not added any tables yet." />
        )}

        {/* ---------------------------------------------------- drafts */}
        {drafts.length > 0 && (
          <>
            <Text variant="h2">Drafts</Text>
            <View style={{ gap: 8 }}>
              {drafts.map((draft) => (
                <Pressable
                  key={draft.id}
                  onPress={() => openDraft(draft)}
                  style={[
                    styles.row,
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
                  {/* Drafts are scratch, so any waiter can bin one. */}
                  <Pressable
                    onPress={() => setDiscarding(draft)}
                    hitSlop={10}
                    accessibilityLabel="Discard draft"
                    style={styles.trash}
                  >
                    <Trash2 size={16} color={theme.colors.destructive} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ------------------------------------------------ categories */}
        <View onLayout={(e) => { menuY.current = e.nativeEvent.layout.y; }}>
          <Text variant="h2">Menu</Text>
          <Text variant="caption" color="mutedForeground">{destination}</Text>
        </View>

        <View style={{ gap: 8 }}>
          {categories.map((category) => {
            const count = productsByCategory.get(category.id)?.length ?? 0;
            // Items already in the cart from this category, so the waiter can
            // see at a glance where they have already ordered.
            const chosen = cart.filter((line) =>
              productsByCategory.get(category.id)?.some((p) => p.id === line.productId),
            ).length;
            const counter = categorySkipsKitchen(category);

            return (
              <Pressable
                key={category.id}
                onPress={() => setOpenCategory(category)}
                style={[
                  styles.row,
                  {
                    borderColor: chosen ? theme.colors.primary : theme.colors.border,
                    backgroundColor: chosen ? tint(theme.colors.primary, 0.06) : theme.colors.card,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text style={{ fontSize: 22, lineHeight: 28, opacity: category.image ? 1 : 0.4 }}>
                  {categoryIcon(category)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySemibold" numberOfLines={1}>{category.name}</Text>
                  <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                    {count} item{count === 1 ? '' : 's'}
                    {chosen ? ` · ${chosen} selected` : ''}
                    {counter ? ' · served from the counter' : ''}
                    {category.description ? ` · ${category.description}` : ''}
                  </Text>
                </View>
                <ChevronRight size={18} color={theme.colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>
        {categories.length === 0 && !categoriesQuery.isLoading && (
          <EmptyState title="No menu yet" description="The owner has not added any categories." />
        )}

      </View>

      {/* ------------------------------------------ category item sheet */}
      <Sheet
        open={!!openCategory}
        onClose={() => setOpenCategory(null)}
        title={openCategory?.name ?? ''}
        description={openCategory?.description}
      >
        <View style={{ gap: theme.spacing.sm }}>
          {(productsByCategory.get(openCategory?.id ?? '') ?? []).map((product) => {
            const qty = qtyOf(product.id);
            return (
              <Pressable
                key={product.id}
                onPress={() => addToCart(product as any)}
                style={[
                  styles.row,
                  {
                    borderColor: qty ? theme.colors.primary : theme.colors.border,
                    backgroundColor: qty ? tint(theme.colors.primary, 0.06) : theme.colors.card,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text style={{ fontSize: 20, lineHeight: 26 }}>{iconOf(product)}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySemibold" numberOfLines={2}>{product.name}</Text>
                  <Text variant="caption" color="mutedForeground">
                    {format(toNumber(product.price))}
                  </Text>
                </View>

                {qty > 0 ? (
                  <View style={styles.stepper}>
                    <Pressable onPress={() => changeQty(product.id, -1)} hitSlop={8}>
                      <Minus size={16} color={theme.colors.foreground} />
                    </Pressable>
                    <Text variant="bodySemibold">{qty}</Text>
                    <Pressable onPress={() => changeQty(product.id, 1)} hitSlop={8}>
                      <Plus size={16} color={theme.colors.foreground} />
                    </Pressable>
                  </View>
                ) : (
                  <Plus size={18} color={theme.colors.mutedForeground} />
                )}
              </Pressable>
            );
          })}

          {(productsByCategory.get(openCategory?.id ?? '') ?? []).length === 0 && (
            <Text variant="caption" color="mutedForeground">
              No items in this category.
            </Text>
          )}
        </View>
      </Sheet>

      {/* -------------------------------------------------- review sheet */}
      <Sheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={appendTo ? 'Add a round' : editingDraft ? 'Edit draft' : 'Review order'}
        description={destination}
        footer={
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            <Button
              onPress={() => submit(false)}
              loading={submitting}
              disabled={!cart.length}
              icon={<Send size={16} color={theme.colors.primaryForeground} />}
              label={
                appendTo
                  ? needsKitchen ? 'Send round to kitchen' : 'Add to order'
                  : needsKitchen ? 'Send to kitchen' : 'Place order'
              }
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
                {editingDraft && (
                  <Button
                    variant="outline"
                    onPress={() => setDiscarding(editingDraft)}
                    disabled={submitting}
                    icon={<Trash2 size={16} color={theme.colors.destructive} />}
                    label="Discard draft"
                  />
                )}
                <Text variant="caption" color="mutedForeground">
                  A draft does not reserve the table — anyone can still take it.
                </Text>
              </>
            )}
          </View>
        }
      >
        {/*
          The order's type, read back from the lines rather than chosen:
          Dine-in, Parcel, or Dine-in + Parcel when the two are mixed.
        */}
        {cart.length > 0 && !appendTo && (
          <View style={styles.typeRow}>
            <View
              style={[
                styles.typePill,
                {
                  borderColor: hasParcel ? theme.colors.info : theme.colors.border,
                  backgroundColor: hasParcel ? `${theme.colors.info}1A` : 'transparent',
                },
              ]}
            >
              <Text variant="caption" style={{ color: hasParcel ? theme.colors.info : theme.colors.mutedForeground }}>
                {allParcel ? 'Parcel' : hasParcel ? 'Dine-in + Parcel' : 'Dine-in'}
              </Text>
            </View>
            {!needsKitchen && (
              <Text variant="caption" color="mutedForeground">Drinks only · not sent to kitchen</Text>
            )}
          </View>
        )}

        {cart.length === 0 ? (
          <Text variant="caption" color="mutedForeground" style={{ paddingVertical: theme.spacing.xl }}>
            Nothing added yet.
          </Text>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {cart.map((line) => (
              <View key={line.productId} style={{ gap: theme.spacing.xs }}>
                <View style={styles.cartRow}>
                  <Text style={{ fontSize: 16, lineHeight: 22 }}>{line.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySemibold" numberOfLines={1}>{line.name}</Text>
                    <Text variant="caption" color="mutedForeground">
                      {format(line.price)} · {format(line.price * line.quantity)}
                      {line.skipKitchen ? ' · counter' : ''}
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => changeQty(line.productId, -1)} hitSlop={8}>
                      <Minus size={16} color={theme.colors.foreground} />
                    </Pressable>
                    <Text variant="bodySemibold">{line.quantity}</Text>
                    <Pressable onPress={() => changeQty(line.productId, 1)} hitSlop={8}>
                      <Plus size={16} color={theme.colors.foreground} />
                    </Pressable>
                  </View>
                </View>
                {/* Drinks never reach the kitchen, so a note would go nowhere. */}
                {!line.skipKitchen && (
                  <Input
                    value={line.notes ?? ''}
                    onChangeText={(text) =>
                      setCart((prev) =>
                        prev.map((l) =>
                          l.productId === line.productId ? { ...l, notes: text } : l,
                        ),
                      )
                    }
                    placeholder="Note for kitchen…"
                  />
                )}
                {/* Per LINE, on every line, including a further round: any
                    dish can go home in a box as a parcel. */}
                <Pressable
                  onPress={() => toggleParcel(line.productId)}
                  style={[
                    styles.parcelToggle,
                    {
                      borderColor: line.isParcel
                        ? theme.colors.info
                        : theme.colors.border,
                      backgroundColor: line.isParcel
                        ? `${theme.colors.info}1A`
                        : 'transparent',
                    },
                  ]}
                >
                  <ShoppingBag
                    size={13}
                    color={line.isParcel ? theme.colors.info : theme.colors.mutedForeground}
                  />
                  <Text
                    variant="caption"
                    style={{
                      color: line.isParcel
                        ? theme.colors.info
                        : theme.colors.mutedForeground,
                    }}
                  >
                    {line.isParcel ? 'Parcel' : 'Dine-in · tap for parcel'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.totalRow, { borderColor: theme.colors.border }]}>
          <Text variant="bodySemibold">Total</Text>
          <Text variant="bodySemibold">{format(cartTotal)}</Text>
        </View>
      </Sheet>

      <ConfirmDialog
        open={!!discarding}
        title="Discard this draft?"
        description={`${discarding?.tableName ?? 'No table'} · ${discarding?.items?.length ?? 0} items. It was never sent to the kitchen, so nothing else changes.`}
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={discardDraft}
        onDecline={() => setDiscarding(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  typePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  parcelToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stack: { gap: 12 },
  tableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tableCard: { width: '31%', borderWidth: 1, padding: 12, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    padding: 12,
  },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trash: { paddingLeft: 6, paddingVertical: 4 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
