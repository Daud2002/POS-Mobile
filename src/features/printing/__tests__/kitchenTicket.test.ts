import {
  buildKitchenTicket,
  KitchenTicketData,
  kitchenTicketFromOrder,
  renderKitchenTicketBitmap,
  renderKitchenTicketText,
} from '../templates/kitchenTicket.template';
import { DEFAULT_PRINTER_PROFILE, PrinterProfile } from '../types';

const profile80: PrinterProfile = { ...DEFAULT_PRINTER_PROFILE };
const profile58: PrinterProfile = {
  ...DEFAULT_PRINTER_PROFILE,
  paperWidth: 58,
  charsPerLine: 32,
};

const ticket: KitchenTicketData = {
  orderNumber: 'ORD-1717257600000-ab12',
  orderSequence: 42,
  tableName: 'T4',
  waiterName: 'Ali',
  orderType: 'dine_in',
  date: new Date('2026-08-19T14:30:00'),
  orderNotes: 'Birthday table, bring the cake with the mains',
  items: [
    {
      name: 'Chicken Karahi Special Family Size',
      quantity: 2,
      categoryName: 'Karahi',
      notes: 'less spicy, no green chillies please',
    },
    { name: 'Garlic Naan', quantity: 4, categoryName: 'Breads' },
  ],
};

describe('kitchen ticket layout', () => {
  it.each([
    ['58mm', profile58],
    ['80mm', profile80],
  ])('keeps every row within the paper width on %s', (_label, profile) => {
    for (const row of renderKitchenTicketText(ticket, profile).split('\n')) {
      expect(row.length).toBeLessThanOrEqual(profile.charsPerLine);
    }
    // 12 dots a column: the 384-dot head of a 58mm printer, 576 of an 80mm.
    expect(renderKitchenTicketBitmap(ticket, profile).width).toBe(profile.charsPerLine * 12);
  });

  it('prints the framed order header with the kitchen copy label', () => {
    const text = renderKitchenTicketText(ticket, profile58);

    expect(text).toContain('KITCHEN ORDER');
    expect(text).toContain('Date: 19-Aug-2026 2:30 PM');
    expect(text).toContain('Order No:');
    expect(text).toContain('42');
    expect(text).toContain('Kitchen Copy');
    expect(text).not.toContain('Customer Copy');
    expect(text).toContain('DINE-IN');
    expect(text).toContain('by: Ali');
    expect(text).toContain('Table No: T4');
  });

  it('prints items with category and notes, but no store header, footer or money', () => {
    const text = renderKitchenTicketText(ticket, profile80);

    expect(text).toContain('Item Description');
    expect(text).toContain('Qty');
    expect(text).toContain('Chicken Karahi');
    expect(text).toContain('(Karahi)');
    expect(text).toContain('(Breads)');
    expect(text).toContain('** less spicy');
    expect(text).toContain('Total items: 6');
    expect(text).toContain('Order notes:');
    expect(text).toContain('Birthday table');

    expect(text).not.toContain('Thank you');
    expect(text).not.toContain('tapntrade.store');
    expect(text).not.toContain('Phone:');
    expect(text).not.toContain('PAYABLE');
    expect(text).not.toContain('Amount');
    expect(text).not.toContain('Rate');
    expect(text).not.toMatch(/PKR|Rs/);
  });

  it('wraps a long dish name instead of clipping it', () => {
    const text = renderKitchenTicketText(ticket, profile58);
    for (const word of ['Chicken', 'Karahi', 'Special', 'Family', 'Size']) {
      expect(text).toContain(word);
    }
    expect(text).toContain('chillies');
    expect(text).toContain('mains');
  });

  it('uses the variant as the heading', () => {
    expect(renderKitchenTicketText({ ...ticket, variant: 'additional' }, profile58)).toContain(
      'ADDITIONAL ROUND',
    );
    expect(renderKitchenTicketText({ ...ticket, variant: 'reprint' }, profile58)).toContain(
      'REPRINT',
    );
    expect(renderKitchenTicketText({ ...ticket, variant: 'cancelled' }, profile58)).toContain(
      'CANCELLED ITEMS',
    );
  });

  it('prints the customer for a takeaway', () => {
    const takeaway = renderKitchenTicketText(
      {
        ...ticket,
        tableName: null,
        orderType: 'takeaway',
        customerName: 'Sara',
        customerPhone: '0300 1112223',
      },
      profile58,
    );
    expect(takeaway).toContain('TAKEAWAY');
    expect(takeaway).toContain('Sara');
    expect(takeaway).toContain('Phone: 0300 1112223');
    expect(takeaway).not.toContain('Table No');

  });

  it.each([
    ['DINE-IN', 'dine_in', [false, false]],
    ['DINE-IN + PARCEL', 'dine_out', [true, false]],
    ['PARCEL', 'dine_out', [true, true]],
  ])('labels the order %s from its lines', (label, orderType, parcels) => {
    const text = renderKitchenTicketText(
      {
        ...ticket,
        orderType: orderType as string,
        items: (parcels as boolean[]).map((isParcel, i) => ({
          name: `Dish ${i + 1}`,
          quantity: 1,
          isParcel,
        })),
      },
      profile58,
    );
    const service = text.split('\n').find((l) => l.includes('by: Ali')) ?? '';
    expect(service.replace(/\u2502/g, '').trim().startsWith(`${label} `)).toBe(true);
    expect(text).not.toMatch(/DINE-OUT|Dine-out/i);
    expect(text.split('>> PARCEL').length - 1).toBe(
      (parcels as boolean[]).filter(Boolean).length,
    );
  });

  it('frames the ticket like the cashier receipt', () => {
    const rows = renderKitchenTicketText(ticket, profile80).split('\n');
    const frame = rows.filter((row) => row.trim().startsWith('\u2502'));
    expect(rows.some((row) => row.trim().startsWith('\u250c'))).toBe(true);
    expect(rows.some((row) => row.trim().startsWith('\u2514'))).toBe(true);
    expect(frame.length).toBeGreaterThan(10);
    // The item table's column rules open and close with the table.
    expect(rows.some((row) => row.includes('\u252c'))).toBe(true);
    expect(rows.some((row) => row.includes('\u253c'))).toBe(true);
    expect(rows.some((row) => row.includes('\u2534'))).toBe(true);
  });

  it.each([
    ['58mm', profile58],
    ['80mm', profile80],
  ])('prints as one image with no text for the printer to look up on %s', (_label, profile) => {
    const bytes = buildKitchenTicket(ticket, profile);
    const { height } = renderKitchenTicketBitmap(ticket, profile);
    const stride = (profile.charsPerLine * 12) / 8;

    // INIT, then GS v 0 bands back to back covering the whole bitmap.
    let i = 2;
    let rows = 0;
    while (bytes[i] === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30) {
      expect(bytes[i + 4] | (bytes[i + 5] << 8)).toBe(stride);
      const band = bytes[i + 6] | (bytes[i + 7] << 8);
      rows += band;
      i += 8 + stride * band;
    }
    expect(rows).toBe(height);
    // Only the feed and the cut are left after the image.
    expect(Array.from(bytes.slice(i))).toEqual([0x1b, 0x64, 3, 0x1d, 0x56, 66, 3]);
  });

  it('draws the left border as one unbroken line', () => {
    const { width, height, data } = renderKitchenTicketBitmap(ticket, profile80);
    const stride = width / 8;
    // Two blank margin columns, then the border down the middle of the next cell.
    const x = 2 * 12 + 6 - 1;
    const on = (y: number) => (data[y * stride + (x >> 3)] & (0x80 >> (x & 7))) !== 0;

    const inked = Array.from({ length: height }, (_, y) => y).filter(on);
    const first = inked[0];
    const last = inked[inked.length - 1];
    expect(last - first).toBeGreaterThan(height / 2);
    expect(inked.length).toBe(last - first + 1);
  });

  it('cuts only when the profile auto-cuts', () => {
    const hasCut = (bytes: Uint8Array) =>
      bytes.some((byte, i) => byte === 0x1d && bytes[i + 1] === 0x56);
    expect(hasCut(buildKitchenTicket(ticket, profile80))).toBe(true);
    expect(hasCut(buildKitchenTicket(ticket, { ...profile80, autoCut: false }))).toBe(false);
  });
});

describe('kitchenTicketFromOrder', () => {
  it('carries category, order notes and customer, and drops skipKitchen lines', () => {
    const data = kitchenTicketFromOrder({
      orderNumber: 'ORD-1-x',
      orderSequence: 7,
      orderType: 'delivery',
      createdAt: '2026-08-19T14:30:00',
      notes: 'Ring the bell twice',
      customerName: 'Sara',
      customerPhone: '0300 1112223',
      items: [
        { productName: 'Burger', quantity: 1, categoryName: 'Grill', notes: 'no onion' },
        { productName: 'Cola', quantity: 2, skipKitchen: true },
      ],
    });

    expect(data.orderNotes).toBe('Ring the bell twice');
    expect(data.customerName).toBe('Sara');
    expect(data.customerPhone).toBe('0300 1112223');
    expect(data.variant).toBe('new');
    expect(data.items).toEqual([
      { name: 'Burger', quantity: 1, categoryName: 'Grill', notes: 'no onion', isParcel: undefined },
    ]);
  });
});
