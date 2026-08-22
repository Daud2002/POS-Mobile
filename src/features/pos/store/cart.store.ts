import { create } from 'zustand';

import { OrderStatus, PaymentMethod, Product } from '@/api/types';
import { toNumber } from '@/lib/format';
import { calculateOrderTotals, OrderTotals } from '@/lib/orderMath';

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  /** Per-unit discount. The API wants a line total, so it is multiplied on send. */
  itemDiscountPerUnit: number;
  /** The product's emoji. The API field is `image`, not `image_emoji`. */
  image?: string;
  /** Stock at the time it was added, so the UI can warn before overselling. */
  stock: number;
}

interface CartState {
  lines: CartLine[];
  customerId?: string;
  customerName?: string;
  paymentMethod: PaymentMethod | null;
  status: OrderStatus | null;
  /** Order-level percentage discount. The web picker is commented out (always 0). */
  discountPercent: number;

  addProduct: (product: Product) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setItemDiscount: (productId: string, perUnit: number) => void;
  removeLine: (productId: string) => void;

  selectCustomer: (id: string, name: string) => void;
  clearCustomer: () => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  markUnpaid: () => void;

  reset: () => void;

  totals: () => OrderTotals;
  itemCount: () => number;
}

const EMPTY = {
  lines: [] as CartLine[],
  customerId: undefined,
  customerName: undefined,
  paymentMethod: null,
  status: null,
  discountPercent: 0,
};

/**
 * The POS cart.
 *
 * Kept out of React Query because it is client state, not server state, and out
 * of component state because the cart sheet, the bottom bar and the checkout
 * hook all read it.
 */
export const useCartStore = create<CartState>((set, get) => ({
  ...EMPTY,

  addProduct: (product) =>
    set((state) => {
      const existing = state.lines.find((line) => line.productId === product.id);

      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          ),
        };
      }

      return {
        lines: [
          ...state.lines,
          {
            productId: product.id,
            name: product.name,
            price: toNumber(product.price),
            quantity: 1,
            itemDiscountPerUnit: 0,
            image: product.image,
            stock: product.stock,
          },
        ],
      };
    }),

  increment: (productId) =>
    set((state) => ({
      lines: state.lines.map((line) =>
        line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line,
      ),
    })),

  // Dropping to zero removes the line, matching the web behaviour.
  decrement: (productId) =>
    set((state) => ({
      lines: state.lines
        .map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity - 1 } : line,
        )
        .filter((line) => line.quantity > 0),
    })),

  setQuantity: (productId, quantity) =>
    set((state) => ({
      lines: state.lines
        .map((line) => (line.productId === productId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    })),

  setItemDiscount: (productId, perUnit) =>
    set((state) => ({
      lines: state.lines.map((line) =>
        line.productId === productId
          ? { ...line, itemDiscountPerUnit: Math.max(0, perUnit) }
          : line,
      ),
    })),

  removeLine: (productId) =>
    set((state) => ({
      lines: state.lines.filter((line) => line.productId !== productId),
    })),

  /**
   * Selecting a customer forces the order unpaid and clears the payment method
   * — this is the credit-sale flow, and it matches the web POS exactly.
   */
  selectCustomer: (id, name) =>
    set({ customerId: id, customerName: name, status: 'unpaid', paymentMethod: null }),

  clearCustomer: () =>
    set({ customerId: undefined, customerName: undefined, status: null }),

  setPaymentMethod: (method) => set({ paymentMethod: method, status: 'paid' }),

  markUnpaid: () => set({ paymentMethod: null, status: 'unpaid' }),

  reset: () => set({ ...EMPTY }),

  totals: () => calculateOrderTotals(get().lines, get().discountPercent),

  itemCount: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),
}));
