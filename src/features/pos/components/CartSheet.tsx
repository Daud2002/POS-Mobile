import { ShoppingCart, User, X } from 'lucide-react-native';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { KeyValueRow } from '@/components/data/KeyValueRow';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useTheme } from '@/theme/ThemeProvider';

import { useCartStore } from '../store/cart.store';
import { CartLineRow } from './CartLineRow';
import { PaymentSelector } from './PaymentSelector';

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  onPickCustomer: () => void;
  submitting: boolean;
}

/**
 * The cart, as a bottom sheet.
 *
 * On web the cart is a fixed 384px right-hand pane; there is no room for that
 * on a phone, so the product grid stays full-width and the cart opens over it.
 */
export function CartSheet({
  open,
  onClose,
  onCheckout,
  onPickCustomer,
  submitting,
}: CartSheetProps) {
  const theme = useTheme();
  const { format } = useStoreCurrency();

  const lines = useCartStore((state) => state.lines);
  const customerId = useCartStore((state) => state.customerId);
  const customerName = useCartStore((state) => state.customerName);
  const paymentMethod = useCartStore((state) => state.paymentMethod);
  const status = useCartStore((state) => state.status);

  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const removeLine = useCartStore((state) => state.removeLine);
  const setItemDiscount = useCartStore((state) => state.setItemDiscount);
  const clearCustomer = useCartStore((state) => state.clearCustomer);
  const setPaymentMethod = useCartStore((state) => state.setPaymentMethod);
  const markUnpaid = useCartStore((state) => state.markUnpaid);

  const totals = useCartStore((state) => state.totals)();
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  // Mirrors the web POS: a payment method AND a status are both required, so an
  // unpaid credit sale is explicit rather than an empty payment method.
  const canCheckout =
    lines.length > 0 && !!status && (status === 'unpaid' || !!paymentMethod) && !submitting;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Current Order"
      description={`${itemCount} item${itemCount === 1 ? '' : 's'}`}
      scrollable={false}
      maxHeightRatio={0.92}
      footer={
        <Button
          label={
            submitting ? 'Processing…' : `Complete Order · ${format(totals.total)}`
          }
          onPress={onCheckout}
          disabled={!canCheckout}
          loading={submitting}
          size="lg"
          fullWidth
        />
      }
    >
      {lines.length === 0 ? (
        <EmptyState
          title="Cart is empty"
          description="Tap products to add them to this order."
          icon={<ShoppingCart size={28} color={theme.colors.mutedForeground} />}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={lines}
            keyExtractor={(line) => line.productId}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <Divider />}
            renderItem={({ item }) => (
              <CartLineRow
                line={item}
                onIncrement={increment}
                onDecrement={decrement}
                onRemove={removeLine}
                onApplyDiscount={setItemDiscount}
              />
            )}
          />

          <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <Divider />

            {/* Customer ------------------------------------------------- */}
            {customerId ? (
              <View style={[styles.customerRow, { gap: theme.spacing.md }]}>
                <User size={16} color={theme.colors.primary} />
                <Text variant="smallMedium" style={{ flex: 1 }} numberOfLines={1}>
                  {customerName}
                </Text>
                <IconButton
                  accessibilityLabel="Clear customer"
                  onPress={clearCustomer}
                  size={30}
                >
                  <X size={14} color={theme.colors.mutedForeground} />
                </IconButton>
              </View>
            ) : (
              <Button
                label="Select Customer"
                variant="outline"
                fullWidth
                icon={<User size={16} color={theme.colors.foreground} />}
                onPress={onPickCustomer}
              />
            )}

            <PaymentSelector
              value={paymentMethod}
              isUnpaid={status === 'unpaid'}
              allowUnpaid={!!customerId}
              onSelect={setPaymentMethod}
              onSelectUnpaid={markUnpaid}
            />

            <Divider />

            {/* Totals ---------------------------------------------------- */}
            <View>
              <KeyValueRow label="Subtotal" value={format(totals.rawSubtotal)} />
              {totals.totalDiscount > 0 ? (
                <KeyValueRow
                  label="Discount"
                  value={`− ${format(totals.totalDiscount)}`}
                  valueColor="success"
                />
              ) : null}
              {totals.tax > 0 ? (
                <KeyValueRow label="Tax" value={format(totals.tax)} />
              ) : null}
              <Divider spacing="sm" />
              <KeyValueRow label="Total" value={format(totals.total)} emphasis />
            </View>
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  customerRow: { flexDirection: 'row', alignItems: 'center' },
});
