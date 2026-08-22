import { calculateOrderTotals } from '@/lib/orderMath';

import { buildReceipt, ReceiptData, renderReceiptText } from '../templates/receipt.template';
import { DEFAULT_PRINTER_PROFILE, PrinterProfile } from '../types';

const profile80: PrinterProfile = { ...DEFAULT_PRINTER_PROFILE };
const profile58: PrinterProfile = {
  ...DEFAULT_PRINTER_PROFILE,
  paperWidth: 58,
  charsPerLine: 32,
};

const receipt: ReceiptData = {
  store: {
    name: 'TapnTrade Demo Store',
    address: '123 Main Street, Lahore',
    phone: '+92 300 1234567',
  },
  invoiceNumber: 'ORD-1717257600000',
  date: new Date('2026-08-19T14:30:00'),
  customerName: 'Walk-in',
  dispatchedBy: 'Store Owner',
  items: [
    { name: 'Coca Cola 1.5L', quantity: 2, unitPrice: 180, discount: 0, total: 360 },
    { name: 'Lays Masala Chips', quantity: 1, unitPrice: 120, discount: 20, total: 100 },
  ],
  rawSubtotal: 480,
  totalDiscount: 20,
  tax: 0,
  total: 460,
  paymentMethod: 'Cash',
  currency: 'PKR',
};

/** Text lines, excluding the trailing feed. */
function lines(data: ReceiptData, profile: PrinterProfile): string[] {
  return renderReceiptText(data, profile).split('\n');
}

describe('receipt layout', () => {
  it('renders every line within the paper width at 32 columns', () => {
    for (const line of lines(receipt, profile58)) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it('renders every line within the paper width at 48 columns', () => {
    for (const line of lines(receipt, profile80)) {
      expect(line.length).toBeLessThanOrEqual(48);
    }
  });

  it('prints the store header, order meta, items and totals', () => {
    const text = renderReceiptText(receipt, profile58);

    expect(text).toContain('TAPNTRADE DEMO STORE');
    expect(text).toContain('Tel: +92 300 1234567');
    expect(text).toContain('INVOICE #:');
    // Only the numeric half of ORD-<epoch> is displayed, as on web.
    expect(text).toContain('1717257600000');
    expect(text).toContain('DISPATCH BY:');
    expect(text).toContain('Coca Cola 1.5L');
    expect(text).toContain('SUBTOTAL:');
    expect(text).toContain('TOTAL:');
    expect(text).toContain('** THANK YOU! **');
    expect(text).toContain('tapntrade.store');
  });

  it('formats money with the store currency symbol', () => {
    expect(renderReceiptText(receipt, profile58)).toContain('Rs460.00');
  });

  it('prints a discount line only when there is a discount', () => {
    expect(renderReceiptText(receipt, profile58)).toContain('DISCOUNT:');

    const noDiscount = { ...receipt, totalDiscount: 0 };
    expect(renderReceiptText(noDiscount, profile58)).not.toContain('DISCOUNT:');
  });

  it('omits the tax line when tax is zero, matching the web receipt', () => {
    expect(renderReceiptText(receipt, profile58)).not.toContain('TAX:');
    expect(renderReceiptText({ ...receipt, tax: 15 }, profile58)).toContain('TAX:');
  });

  it('marks reprints so a duplicate is distinguishable from the original', () => {
    expect(renderReceiptText({ ...receipt, isReprint: true }, profile58)).toContain(
      '*** REPRINT ***',
    );
  });

  it('wraps a long product name instead of truncating it', () => {
    const longName = {
      ...receipt,
      items: [
        {
          name: 'Nestle Milkpak Full Cream Milk One Litre Carton',
          quantity: 1,
          unitPrice: 250,
          discount: 0,
          total: 250,
        },
      ],
    };

    const text = renderReceiptText(longName, profile58);

    // The web app does `name.substring(0, 15)`, so it would print only
    // "Nestle Milkpak" and silently lose the rest.
    expect(text).toContain('Nestle Milkpak');
    expect(text).toContain('Carton');

    for (const line of text.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it('survives a 30-item receipt without any line overflowing', () => {
    const many: ReceiptData = {
      ...receipt,
      items: Array.from({ length: 30 }, (_, i) => ({
        name: `Product Number ${i + 1} With A Long Name`,
        quantity: i + 1,
        unitPrice: 99.5,
        discount: 0,
        total: 99.5 * (i + 1),
      })),
    };

    for (const line of lines(many, profile58)) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it('produces a byte stream, not a string', () => {
    const bytes = buildReceipt(receipt, profile58);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    // ESC @ must lead.
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
  });

  it('appends a cut only when autoCut is enabled', () => {
    const withCut = buildReceipt(receipt, { ...profile58, autoCut: true });
    const withoutCut = buildReceipt(receipt, { ...profile58, autoCut: false });

    const hasCut = (bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length - 2; i += 1) {
        if (bytes[i] === 0x1d && bytes[i + 1] === 0x56) return true;
      }
      return false;
    };

    expect(hasCut(withCut)).toBe(true);
    expect(hasCut(withoutCut)).toBe(false);
  });
});

describe('order totals', () => {
  // These must match Frontend/src/pages/cashier/POSScreen.tsx:272-279 exactly:
  // POST /orders takes `total` verbatim from the client, so any drift here
  // writes different totals than the web POS for an identical cart.
  it('subtracts per-item discounts from the subtotal', () => {
    const totals = calculateOrderTotals([
      { price: 180, quantity: 2, itemDiscountPerUnit: 0 },
      { price: 120, quantity: 1, itemDiscountPerUnit: 20 },
    ]);

    expect(totals.rawSubtotal).toBe(480);
    expect(totals.itemDiscounts).toBe(20);
    expect(totals.subtotal).toBe(460);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(460);
  });

  it('applies a percentage discount on top of the discounted subtotal', () => {
    const totals = calculateOrderTotals(
      [{ price: 100, quantity: 2, itemDiscountPerUnit: 10 }],
      10,
    );

    expect(totals.subtotal).toBe(180);
    expect(totals.percentageDiscountAmt).toBe(18);
    // `discount` sent to the API is itemDiscounts + percentageDiscountAmt...
    expect(totals.totalDiscount).toBe(38);
    // ...but `total` subtracts only the percentage part, because the item
    // discounts are already inside `subtotal`.
    expect(totals.total).toBe(162);
  });

  it('returns zeros for an empty cart', () => {
    const totals = calculateOrderTotals([]);
    expect(totals.total).toBe(0);
    expect(totals.rawSubtotal).toBe(0);
  });

  it('rounds to 2dp so floating point drift never reaches the API', () => {
    const totals = calculateOrderTotals([
      { price: 0.1, quantity: 3, itemDiscountPerUnit: 0 },
    ]);
    expect(totals.total).toBe(0.3);
  });
});
