import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Printer, Share2, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { queryKeys } from '@/api/queryKeys';
import { ordersApi } from '@/api/services';
import { RootStackScreenProps } from '@/app/navigation/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { KeyValueRow } from '@/components/data/KeyValueRow';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { paymentLabel } from '@/constants/statuses';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { useReceiptShare } from '@/features/printing/hooks/useReceiptShare';
import { receiptFromInvoice } from '@/features/printing/templates/receiptFromOrder';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { orderNumberLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Post-sale confirmation.
 *
 * Loads the invoice so the totals shown (and any reprint) come from the
 * database rather than from cart state, which by this point has been cleared.
 * The web version reads `completedOrder?.order_number` here — a snake_case
 * field the API does not return — so its order number renders undefined.
 */
export function OrderCompleteScreen({
  route,
  navigation,
}: RootStackScreenProps<'OrderComplete'>) {
  const { orderId } = route.params;
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const { format, currency } = useStoreCurrency();
  const { printReceipt, hasPrinter } = usePrinter();
  const { shareAsPdf, busy: sharing } = useReceiptShare();

  const [reprinting, setReprinting] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: queryKeys.invoice(orderId),
    queryFn: () => ordersApi.getInvoice(orderId),
  });

  const receipt = invoice
    ? receiptFromInvoice({ invoice, user, fallbackCurrency: currency })
    : null;

  const handleReprint = async () => {
    if (!receipt) return;

    setReprinting(true);
    const result = await printReceipt(receipt);
    setReprinting(false);

    if (result.ok) toast.success('Receipt sent to printer');
    else toast.error(result.error ?? 'Receipt printing failed');
  };

  /** Works everywhere, and is the only receipt path on iOS with a Classic printer. */
  const handleShare = async () => {
    if (!receipt) return;
    const result = await shareAsPdf(receipt);
    if (!result.ok) toast.error(result.error ?? 'Could not share the receipt.');
  };

  if (isLoading || !invoice) {
    return (
      <Screen>
        <Spinner fill size="large" />
      </Screen>
    );
  }

  const { order } = invoice;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Screen scrollable>
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: theme.tint(theme.colors.success, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckCircle2 size={36} color={theme.colors.success} />
        </View>

        <Text variant="displayLarge">Order Complete!</Text>
        <Text variant="small" color="mutedForeground">
          Order #{orderNumberLabel(order.orderNumber)}
        </Text>
      </View>

      <Card padding="xl">
        <KeyValueRow label="Items" value={String(itemCount)} />
        <KeyValueRow label="Payment" value={paymentLabel(order.paymentMethod)} />
        <KeyValueRow label="Status" value={order.status} />
        {order.discount > 0 ? (
          <KeyValueRow
            label="Discount"
            value={`− ${format(order.discount)}`}
            valueColor="success"
          />
        ) : null}
        <Divider spacing="sm" />
        <KeyValueRow label="Total" value={format(order.total)} emphasis />
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <Button
          label={reprinting ? 'Printing…' : 'Print Receipt Again'}
          variant="outline"
          fullWidth
          size="lg"
          loading={reprinting}
          disabled={reprinting}
          icon={<Printer size={18} color={theme.colors.foreground} />}
          onPress={handleReprint}
        />

        <Button
          label={sharing ? 'Preparing…' : 'Share as PDF'}
          variant="ghost"
          fullWidth
          loading={sharing}
          disabled={sharing}
          icon={<Share2 size={18} color={theme.colors.foreground} />}
          onPress={handleShare}
        />

        {!hasPrinter ? (
          <Text variant="caption" color="mutedForeground" align="center">
            No printer set up yet — add one in Settings › Printer Setup, or share the
            receipt as a PDF.
          </Text>
        ) : null}

        <Button
          label="New Order"
          fullWidth
          size="lg"
          icon={<ShoppingBag size={18} color={theme.colors.primaryForeground} />}
          onPress={() => navigation.goBack()}
        />
      </View>
    </Screen>
  );
}
