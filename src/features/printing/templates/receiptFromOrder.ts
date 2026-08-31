import { AppUser, InvoiceData, Order, RestaurantOrder, Store } from '@/api/types';
import { paymentLabel } from '@/constants/statuses';
import { toNumber } from '@/lib/format';
import { orderDestination, orderTypeLabel } from '@/lib/orderLabel';

import { ReceiptData } from './receipt.template';

/**
 * The name printed on the "DISPATCH BY" line.
 *
 * The web version also tests `user.id === storeData.ownerId`, but the Store
 * entity's column is `userId` — there is no `ownerId` — so that half of the
 * check never matches. Only the role test does any work, so that is all this
 * keeps.
 */
function dispatcherName(user: AppUser | null): string {
  if (!user) return 'Employee';
  return user.role === 'store_owner' ? 'Store Owner' : user.name || 'Employee';
}

/**
 * Builds receipt data from the order the API just returned.
 *
 * Using the server's response rather than local cart state means the printed
 * totals are the stored totals — the two cannot drift.
 */
export function receiptFromOrder(params: {
  order: Order;
  store: Store | null;
  user: AppUser | null;
  currency: string;
  customerName?: string;
  isReprint?: boolean;
}): ReceiptData {
  const { order, store, user, currency, customerName, isReprint } = params;

  const items = (order.items ?? []).map((item) => ({
    name: item.productName ?? 'Item',
    quantity: item.quantity,
    unitPrice: toNumber(item.unitPrice),
    discount: toNumber(item.discount),
    total: toNumber(item.total),
  }));

  // The receipt's SUBTOTAL line is the pre-discount sum, matching the web
  // layout. Note the DB's `subtotal` column is post-item-discount, so the two
  // are deliberately different numbers.
  const rawSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return {
    store: {
      name: store?.name || 'Store',
      address: store?.address,
      phone: store?.phone,
    },
    invoiceNumber: order.orderNumber,
    date: new Date(order.createdAt),
    customerName: customerName ?? order.customerName ?? order.customer?.name,
    dispatchedBy: dispatcherName(user),
    items,
    rawSubtotal,
    totalDiscount: toNumber(order.discount),
    tax: toNumber(order.tax),
    total: toNumber(order.total),
    paymentMethod: order.paymentMethod ? paymentLabel(order.paymentMethod) : undefined,
    currency,
    isReprint,
  };
}

/**
 * Builds receipt data from GET /invoices/:orderId — the reprint path.
 *
 * The invoice endpoint already coerces its decimals server-side and carries the
 * store block, so this needs no extra fetches.
 */
export function receiptFromInvoice(params: {
  invoice: InvoiceData;
  user: AppUser | null;
  fallbackCurrency: string;
  isReprint?: boolean;
}): ReceiptData {
  const { invoice, user, fallbackCurrency, isReprint = true } = params;
  const { order, store, customer } = invoice;

  const items = order.items.map((item) => ({
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    total: item.total,
  }));

  const rawSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return {
    store: {
      name: store?.name || 'Store',
      address: store?.address,
      phone: store?.phone,
    },
    invoiceNumber: order.orderNumber,
    date: new Date(order.createdAt),
    customerName: customer?.name,
    dispatchedBy: dispatcherName(user),
    items,
    rawSubtotal,
    totalDiscount: order.discount,
    tax: order.tax,
    total: order.total,
    paymentMethod: order.paymentMethod ? paymentLabel(order.paymentMethod) : undefined,
    currency: store?.currency || fallbackCurrency,
    isReprint,
  };
}

/** A representative receipt for the Printer Setup screen's Test Print. */
export function sampleReceipt(currency: string): ReceiptData {
  return {
    store: {
      name: 'TapnTrade Demo Store',
      address: '123 Main Street, Lahore',
      phone: '+92 300 1234567',
    },
    invoiceNumber: 'ORD-1717257600000',
    date: new Date(),
    customerName: 'Walk-in',
    dispatchedBy: 'Store Owner',
    items: [
      { name: 'Coca Cola 1.5L Bottle', quantity: 2, unitPrice: 180, discount: 0, total: 360 },
      { name: 'Lays Masala Chips', quantity: 1, unitPrice: 120, discount: 20, total: 100 },
      { name: 'Milk Pak Full Cream 1L', quantity: 3, unitPrice: 250, discount: 0, total: 750 },
    ],
    rawSubtotal: 1230,
    totalDiscount: 20,
    tax: 0,
    total: 1210,
    paymentMethod: 'Cash',
    currency,
  };
}

/**
 * Restaurant variant.
 *
 * Differs from receiptFromOrder in what identifies the sale: a restaurant
 * receipt is identified by its table and the waiter who served it, not by the
 * cashier who happened to ring it up.
 */
export function receiptFromRestaurantOrder(params: {
  order: RestaurantOrder;
  store: Store | null | undefined;
  currency: string;
  isReprint?: boolean;
}): ReceiptData {
  const { order, store, currency, isReprint } = params;

  const items = (order.items ?? []).map((item) => ({
    name: item.productName ?? 'Item',
    quantity: item.quantity,
    unitPrice: toNumber(item.unitPrice),
    discount: 0,
    total: toNumber(item.total),
    isParcel: item.isParcel,
  }));

  const rawSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const destination = orderDestination(order);

  return {
    store: {
      name: store?.name || 'Restaurant',
      address: store?.address,
      phone: store?.phone,
    },
    // The customer-facing number is the per-store sequence, not the internal id.
    invoiceNumber: order.orderSequence ? `#${order.orderSequence}` : order.orderNumber,
    date: new Date(order.createdAt),
    customerName: order.customerName ?? destination,
    // Printed as their own rows, so a dine-out bill says so explicitly rather
    // than being indistinguishable from a plain dine-in one.
    orderTypeLabel:
      order.orderType && order.orderType !== 'none'
        ? orderTypeLabel(order.orderType)
        : undefined,
    tableName: order.tableName,
    // The rider works from this paper on a delivery order.
    customerPhone: order.customerPhone,
    deliveryAddress: order.orderType === 'delivery' ? order.deliveryAddress : undefined,
    // The waiter is who the customer dealt with, so that is the useful name.
    dispatchedBy: order.waiterName ?? 'Staff',
    items,
    rawSubtotal,
    totalDiscount: toNumber(order.discount),
    tax: 0,
    total: toNumber(order.total),
    paymentMethod: order.paymentMethod ? paymentLabel(order.paymentMethod) : undefined,
    currency,
    isReprint,
  };
}
