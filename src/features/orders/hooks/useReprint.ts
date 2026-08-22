import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { queryKeys } from '@/api/queryKeys';
import { ordersApi } from '@/api/services';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { receiptFromInvoice } from '@/features/printing/templates/receiptFromOrder';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';

/**
 * Reprints a past order's receipt.
 *
 * Possible only because receipts are built from the invoice rather than from
 * cart state — on web, once `newOrder()` clears the cart the receipt data is
 * gone and there is no reprint path at all.
 */
export function useReprint() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { currency } = useStoreCurrency();
  const { printReceipt } = usePrinter();

  const [reprintingId, setReprintingId] = useState<string | null>(null);

  const reprint = useCallback(
    async (orderId: string) => {
      setReprintingId(orderId);
      try {
        const invoice = await queryClient.fetchQuery({
          queryKey: queryKeys.invoice(orderId),
          queryFn: () => ordersApi.getInvoice(orderId),
        });

        const result = await printReceipt(
          receiptFromInvoice({ invoice, user, fallbackCurrency: currency }),
        );

        if (result.ok) toast.success('Receipt sent to printer');
        else toast.error(result.error ?? 'Receipt printing failed');
      } catch {
        toast.error('Could not load the receipt for this order.');
      } finally {
        setReprintingId(null);
      }
    },
    [queryClient, printReceipt, user, currency, toast],
  );

  return { reprint, reprintingId };
}
