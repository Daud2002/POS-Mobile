import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { ordersApi } from '@/api/services';
import { CreateOrderPayload, Order, Store } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { usePrinter } from '@/features/printing/hooks/usePrinter';
import { receiptFromOrder } from '@/features/printing/templates/receiptFromOrder';
import { lineDiscountTotal } from '@/lib/orderMath';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useStoreId } from '@/hooks/useStoreId';

import { useCartStore } from '../store/cart.store';

interface CheckoutResult {
  order: Order;
  printed: boolean;
  printError?: string;
}

/**
 * Turns the cart into an order, then prints the receipt.
 *
 * Two rules carried over from the web POS, both deliberate:
 *
 *  1. `total` is computed client-side and sent verbatim — the server recomputes
 *     `subtotal` but trusts `total` as given, so the arithmetic in
 *     lib/orderMath.ts must match the web app exactly.
 *
 *  2. A print failure NEVER fails the sale. The order is already saved by then;
 *     a flat printer battery must not cost the store a transaction.
 */
export function useCheckout(store: Store | null) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const storeId = useStoreId();
  const { currency } = useStoreCurrency();
  const { printReceipt } = usePrinter();

  const [lastResult, setLastResult] = useState<CheckoutResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<CheckoutResult> => {
      const cart = useCartStore.getState();
      const totals = cart.totals();

      const payload: CreateOrderPayload = {
        paymentMethod: cart.status !== 'unpaid' ? cart.paymentMethod : null,
        customerId: cart.customerId,
        tax: totals.tax,
        discount: totals.totalDiscount,
        status: cart.status ?? 'paid',
        notes: '',
        total: totals.total,
        items: cart.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.price,
          // The API expects a LINE total here, not a per-unit amount.
          discount: lineDiscountTotal(line),
        })),
      };

      const order = await ordersApi.create(payload);

      // The receipt is built from the SERVER's order, not from cart state, so
      // the printed totals are the stored totals — and the same order can be
      // reprinted later from history.
      const receipt = receiptFromOrder({
        order,
        store,
        user,
        currency,
        customerName: cart.customerName,
      });

      const print = await printReceipt(receipt);

      return { order, printed: print.ok, printError: print.error };
    },

    onSuccess: (result) => {
      setLastResult(result);

      // Stock changed and a new order exists — let both lists refetch.
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
      if (storeId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.activeProducts(storeId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.products(storeId) });
      }

      if (!result.printed) {
        toast.warning(result.printError ?? 'Receipt printing failed');
      }

      useCartStore.getState().reset();
    },

    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : 'Could not complete the order.';
      toast.error(message);
    },
  });

  return {
    checkout: mutation.mutateAsync,
    submitting: mutation.isPending,
    lastResult,
    clearResult: () => setLastResult(null),
  };
}
