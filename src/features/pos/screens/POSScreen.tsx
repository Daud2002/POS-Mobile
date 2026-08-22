import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PackageSearch, ScanLine } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Product } from '@/api/types';
import { RootStackParamList } from '@/app/navigation/types';
import { PageFade } from '@/components/layout/PageFade';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPillRow } from '@/components/ui/FilterPill';
import { IconButton } from '@/components/ui/IconButton';
import { SearchInput } from '@/components/ui/SearchInput';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/theme/ThemeProvider';

import { BarcodeScannerSheet } from '../components/BarcodeScannerSheet';
import { CartBar } from '../components/CartBar';
import { CartSheet } from '../components/CartSheet';
import { CustomerPickerSheet } from '../components/CustomerPickerSheet';
import { ProductCard } from '../components/ProductCard';
import { useCheckout } from '../hooks/useCheckout';
import { usePosCatalog } from '../hooks/usePosCatalog';
import { useCartStore } from '../store/cart.store';

const COLUMNS = 2;

/**
 * The point-of-sale screen.
 *
 * The web version is a single 645-line component; here the product grid, cart,
 * customer picker, payment selector and scanner are each their own component
 * and the data/checkout logic lives in hooks, so this file only wires them up.
 */
export function POSScreen() {
  const theme = useTheme();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const catalog = usePosCatalog();
  const { checkout, submitting } = useCheckout(catalog.store);

  const lines = useCartStore((state) => state.lines);
  const addProduct = useCartStore((state) => state.addProduct);
  const selectCustomer = useCartStore((state) => state.selectCustomer);
  const totals = useCartStore((state) => state.totals)();

  const [cartOpen, setCartOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const quantityInCart = useCallback(
    (productId: string) =>
      lines.find((line) => line.productId === productId)?.quantity ?? 0,
    [lines],
  );

  const handleAdd = useCallback(
    (product: Product) => {
      if (product.stock <= 0) {
        toast.warning(`${product.name} is out of stock`);
        return;
      }
      addProduct(product);
    },
    [addProduct, toast],
  );

  /** Barcode path — the web app uses a hidden autofocused keyboard-wedge input. */
  const handleBarcode = useCallback(
    (barcode: string) => {
      const product = catalog.findByBarcode(barcode);
      if (!product) {
        toast.error(`Product with barcode "${barcode}" not found`);
        return;
      }
      handleAdd(product);
      toast.success(`Added ${product.name}`);
    },
    [catalog, handleAdd, toast],
  );

  const handleCheckout = async () => {
    try {
      const result = await checkout();
      setCartOpen(false);
      navigation.navigate('OrderComplete', { orderId: result.order.id });
    } catch {
      // useCheckout already surfaced the error; the cart stays intact so the
      // sale can be retried.
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <PageFade>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <SearchInput
            containerStyle={{ flex: 1 }}
            value={catalog.search}
            onChangeText={catalog.setSearch}
            placeholder="Search products…"
          />
          <IconButton
            accessibilityLabel="Scan barcode"
            onPress={() => setScannerOpen(true)}
            tone="primary"
            size={44}
          >
            <ScanLine size={20} color={theme.colors.primary} />
          </IconButton>
        </View>

        <FilterPillRow
          options={catalog.categoryOptions}
          value={catalog.categoryId}
          onChange={catalog.setCategoryId}
        />
      </View>

      {catalog.loading ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
          }}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={{ width: '47%' }}>
              <SkeletonCard lines={2} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={catalog.filtered}
          keyExtractor={(product) => product.id}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: theme.spacing.md }}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={catalog.refetching}
              onRefresh={catalog.refetch}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={catalog.search ? 'No matching products' : 'No products yet'}
              description={
                catalog.search
                  ? 'Try a different search or category.'
                  : 'Add products from the Products screen to start selling.'
              }
              icon={<PackageSearch size={28} color={theme.colors.mutedForeground} />}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              inCart={quantityInCart(item.id)}
              onPress={handleAdd}
            />
          )}
        />
      )}

      {catalog.error ? (
        <Text
          variant="caption"
          color="destructive"
          align="center"
          style={{ paddingHorizontal: theme.spacing.lg }}
        >
          Could not load products. Pull down to retry.
        </Text>
      ) : null}

      <CartBar itemCount={itemCount} total={totals.total} onPress={() => setCartOpen(true)} />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={handleCheckout}
        onPickCustomer={() => setCustomerPickerOpen(true)}
        submitting={submitting}
      />

      <CustomerPickerSheet
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(customer) => selectCustomer(customer.id, customer.name)}
      />

      <BarcodeScannerSheet
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcode}
      />
      </PageFade>
    </SafeAreaView>
  );
}
