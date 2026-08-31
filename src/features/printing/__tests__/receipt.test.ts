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

/**
 * The frame characters as printedRows() sees them: CP437 bytes read back as
 * their raw char codes. 0xB3 is the vertical rule, 0xDA/0xC0/0xC3 the left
 * edge of top/bottom/mid rules, 0xBF/0xD9/0xB4 the right edges.
 */
const FRAME_STARTS = [0xb3, 0xda, 0xc0, 0xc3].map((c) => String.fromCharCode(c));
const FRAME_ENDS = [0xb3, 0xbf, 0xd9, 0xb4].map((c) => String.fromCharCode(c));

/**
 * Each printed line with the number of COLUMNS it occupies on paper.
 *
 * Walks the raw ESC/POS stream so double-width characters (GS ! 0x11) are
 * counted as the two columns they actually consume.
 */
function printedRows(bytes: Uint8Array): Array<{ text: string; columns: number }> {
  const rows: Array<{ text: string; columns: number }> = [];
  let text = '';
  let columns = 0;
  let doubled = false;

  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];

    if (byte === 0x1b) {
      // ESC @ takes no parameter; the rest here take one.
      i += bytes[i + 1] === 0x40 ? 1 : 2;
      continue;
    }
    if (byte === 0x1d) {
      if (bytes[i + 1] === 0x21) doubled = (bytes[i + 2] & 0x10) !== 0;
      i += 2;
      continue;
    }
    if (byte === 0x0a) {
      rows.push({ text, columns });
      text = '';
      columns = 0;
      continue;
    }
    text += String.fromCharCode(byte);
    columns += doubled ? 2 : 1;
  }

  if (text) rows.push({ text, columns });
  return rows;
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
    expect(text).toContain('Phone: +92 300 1234567');
    // Only the numeric half of ORD-<epoch> is displayed, as on web.
    expect(text).toContain('1717257600000');
    expect(text).toContain('Customer Copy');
    expect(text).toContain('Order Number:');
    expect(text).toContain('Served by: Store Owner');
    expect(text).toContain('Coca Cola');
    expect(text).toContain('Items:');
    expect(text).toContain('PAYABLE');
    expect(text).toContain('Thank you for visiting!');
    expect(text).toContain('tapntrade.store');
  });

  /**
   * The frame is the whole point of the layout: one row a column too wide and
   * the border visibly zigzags down the paper.
   *
   * Measured from the BYTES, not the decoded text: a character printed after
   * `GS ! 0x11` is double width and occupies two columns, so the big PAYABLE
   * figure is 8 characters but 16 columns. Counting string length would call a
   * correctly-aligned row broken.
   */
  it('draws a closed frame on both paper widths', () => {
    for (const [profile, width] of [
      [profile58, 32],
      [profile80, 48],
    ] as const) {
      const rows = printedRows(buildReceipt(receipt, profile));
      const framed = rows.filter((r) => FRAME_STARTS.includes(r.text[0]));

      expect(framed.length).toBeGreaterThan(8);
      for (const row of framed) {
        expect([row.text, row.columns]).toEqual([row.text, width]);
        expect(FRAME_ENDS.includes(row.text[row.text.length - 1])).toBe(true);
      }
    }
  });

  /** The rider works from this paper — name, phone and address must be on it. */
  it('prints the customer details on a delivery order', () => {
    const delivery: ReceiptData = {
      ...receipt,
      tableName: null,
      orderTypeLabel: 'Delivery',
      customerName: 'Ali Raza',
      customerPhone: '0300-1234567',
      deliveryAddress: '12 Main Street, Model Town',
    };
    const text = renderReceiptText(delivery, profile80);

    expect(text).toContain('Delivery');
    expect(text).toContain('Ali Raza');
    expect(text).toContain('Phone: 0300-1234567');
    expect(text).toContain('Deliver to: 12 Main Street, Model');

    // And a long address must wrap inside the frame, not burst it.
    const rows = printedRows(buildReceipt(delivery, profile58)).filter((r) =>
      FRAME_STARTS.includes(r.text[0]),
    );
    for (const row of rows) {
      expect([row.text, row.columns]).toEqual([row.text, 32]);
    }
  });

  it('heads the item table', () => {
    const wide = renderReceiptText(receipt, profile80);
    expect(wide).toContain('Item Description');
    expect(wide).toContain('Rate');

    // 58mm drops the rate column so the dish name keeps usable width.
    const narrow = renderReceiptText(receipt, profile58);
    expect(narrow).toContain('Qty');
    expect(narrow).toContain('Amount');
    expect(narrow).not.toContain('Rate');
  });

  it('formats money with the store currency symbol', () => {
    expect(renderReceiptText(receipt, profile58)).toContain('Rs460.00');
  });

  it('prints a discount line only when there is a discount', () => {
    expect(renderReceiptText(receipt, profile58)).toContain('Discount');

    const noDiscount = { ...receipt, totalDiscount: 0, items: [receipt.items[0]] };
    expect(renderReceiptText(noDiscount, profile58)).not.toContain('Discount');
  });

  it('omits the tax line when tax is zero, matching the web receipt', () => {
    expect(renderReceiptText(receipt, profile58)).not.toContain('Tax');
    expect(renderReceiptText({ ...receipt, tax: 15 }, profile58)).toContain('Tax');
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

    // Wrapped across framed continuation rows rather than clipped, so the
    // first and LAST words both survive.
    expect(text).toContain('Nestle');
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
