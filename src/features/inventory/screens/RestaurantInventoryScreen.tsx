import { AlertTriangle, History, PackagePlus, Pencil, Scale, Trash2, Warehouse } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InventoryItem } from '@/api/types';
import { PageFade } from '@/components/layout/PageFade';
import { SectionHeader } from '@/components/layout/SectionHeader';
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterPillRow,
  IconButton,
  SearchInput,
  SkeletonList,
  Text,
} from '@/components/ui';
import { Fab } from '@/components/ui/Fab';
import { useDebouncedValue } from '@/hooks/useDebouncedCallback';
import { useTheme } from '@/theme/ThemeProvider';

import { AdjustStockSheet } from '../components/AdjustStockSheet';
import { InventoryItemFormSheet } from '../components/InventoryItemFormSheet';
import { MovementsSheet } from '../components/MovementsSheet';
import { StockInSheet } from '../components/StockInSheet';
import { useRestaurantInventory } from '../hooks/useRestaurantInventory';
import { formatQuantity, formatSets, isLowStock } from '../lib/quantity';

type Filter = 'active' | 'low' | 'all';

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'low', label: 'Low stock' },
  { value: 'all', label: 'All, incl. retired' },
];

/**
 * A restaurant's ingredients — millilitres, grams and bottles — that recipes
 * draw down whenever an order is settled.
 *
 * Deliberately separate from the general store's InventoryScreen, which nudges
 * whole-unit product stock: here counts only move through stock-in, adjust and
 * sales, each leaving a movement behind.
 */
export function RestaurantInventoryScreen() {
  const theme = useTheme();
  const inventory = useRestaurantInventory();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [filter, setFilter] = useState<Filter>('active');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [stocking, setStocking] = useState<InventoryItem | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);

  const items = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return inventory.items.filter((item) => {
      if (filter !== 'all' && !item.isActive) return false;
      if (filter === 'low' && !isLowStock(item)) return false;
      return !term || item.name.toLowerCase().includes(term);
    });
  }, [inventory.items, debouncedSearch, filter]);

  const lowCount = useMemo(
    () => inventory.items.filter((item) => item.isActive && isLowStock(item)).length,
    [inventory.items],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <PageFade>
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            gap: theme.spacing.lg,
          }}
        >
          <SectionHeader
            title="Inventory"
            subtitle="Ingredients used up by your recipes as orders are paid"
          />
          <SearchInput value={search} onChangeText={setSearch} placeholder="Search ingredients…" />
          <FilterPillRow<Filter> options={FILTERS} value={filter} onChange={setFilter} />

          {lowCount > 0 ? (
            <Card
              padding="lg"
              style={{
                backgroundColor: theme.tint(theme.colors.destructive, 0.06),
                borderColor: theme.tint(theme.colors.destructive, 0.3),
              }}
            >
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <AlertTriangle size={18} color={theme.colors.destructive} />
                <Text variant="small" style={{ flex: 1 }}>
                  <Text variant="bodySemibold" color="destructive">
                    {lowCount}
                  </Text>{' '}
                  item{lowCount === 1 ? ' is' : 's are'} low or out of stock.
                </Text>
              </View>
            </Card>
          ) : null}
        </View>

        {inventory.loading ? (
          <View style={{ padding: theme.spacing.lg }}>
            <SkeletonList count={6} lines={1} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              padding: theme.spacing.lg,
              paddingBottom: theme.spacing.lg * 5,
              gap: theme.spacing.md,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={inventory.refetching}
                onRefresh={inventory.refetch}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title={search || filter !== 'active' ? 'Nothing matches' : 'No ingredients yet'}
                description={
                  search || filter !== 'active'
                    ? 'Try a different search or filter.'
                    : 'Add what your kitchen stocks — milk in ml, flour in g, drinks in bottles.'
                }
                icon={<Warehouse size={28} color={theme.colors.mutedForeground} />}
                actionLabel={search || filter !== 'active' ? undefined : 'Add Item'}
                onAction={search || filter !== 'active' ? undefined : openCreate}
              />
            }
            renderItem={({ item }) => {
              const low = isLowStock(item);
              const sets = item.unit === 'bottle' ? formatSets(item.quantity, item.packSize) : null;

              return (
                <Card
                  padding="lg"
                  style={
                    low && item.isActive
                      ? { backgroundColor: theme.tint(theme.colors.destructive, 0.04) }
                      : undefined
                  }
                >
                  <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text variant="caption" color="mutedForeground">
                        {item.unit === 'bottle' ? `Bottles · sets of ${item.packSize}` : item.unit}
                        {item.lowStockThreshold !== null
                          ? ` · low at ${formatQuantity(item.lowStockThreshold, item.unit)}`
                          : ''}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: theme.spacing.xs }}>
                      <Text variant="bodySemibold" color={low ? 'destructive' : 'foreground'}>
                        {formatQuantity(item.quantity, item.unit)}
                      </Text>
                      {sets ? (
                        <Text variant="caption" color="mutedForeground">
                          {sets}
                        </Text>
                      ) : null}
                      {!item.isActive ? (
                        <Badge label="Retired" />
                      ) : low ? (
                        <Badge
                          label={item.quantity < 0 ? 'Below zero' : 'Low stock'}
                          tone="destructive"
                          dot
                        />
                      ) : null}
                    </View>
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
                      accessibilityLabel={`Stock in ${item.name}`}
                      onPress={() => setStocking(item)}
                    >
                      <PackagePlus size={16} color={theme.colors.primary} />
                    </IconButton>
                    <IconButton
                      accessibilityLabel={`Adjust count of ${item.name}`}
                      onPress={() => setAdjusting(item)}
                    >
                      <Scale size={16} color={theme.colors.foreground} />
                    </IconButton>
                    <IconButton
                      accessibilityLabel={`History of ${item.name}`}
                      onPress={() => setHistory(item)}
                    >
                      <History size={16} color={theme.colors.foreground} />
                    </IconButton>
                    <IconButton accessibilityLabel={`Edit ${item.name}`} onPress={() => openEdit(item)}>
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
              );
            }}
          />
        )}

        <Fab onPress={openCreate} accessibilityLabel="Add inventory item" />

        <InventoryItemFormSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          item={editing}
          saving={inventory.saving}
          onCreate={inventory.create}
          onUpdate={(id, payload) => inventory.update({ id, payload })}
        />

        <StockInSheet
          item={stocking}
          onClose={() => setStocking(null)}
          saving={inventory.stocking}
          onSubmit={(id, payload) => inventory.stockIn({ id, payload })}
        />

        <AdjustStockSheet
          item={adjusting}
          onClose={() => setAdjusting(null)}
          saving={inventory.adjusting}
          onSubmit={(id, payload) => inventory.adjust({ id, payload })}
        />

        <MovementsSheet item={history} onClose={() => setHistory(null)} />

        <ConfirmDialog
          open={!!deleting}
          title="Delete Item"
          description={`"${deleting?.name}" and its stock history will be removed. An item still used by a recipe cannot be deleted — retire it instead.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            // The error toast (e.g. the server's "used in 2 recipes") has
            // already been shown; close either way.
            if (deleting) await inventory.remove(deleting.id).catch(() => undefined);
            setDeleting(null);
          }}
          onDecline={() => setDeleting(null)}
        />
      </PageFade>
    </SafeAreaView>
  );
}
