import {
  buildKitchenTicket,
  KitchenTicketData,
  kitchenTicketFromOrder,
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

/**
 * Each printed line with the number of COLUMNS it occupies on paper, counting
 * double-width characters (GS ! 0x1x) as the two columns they consume.
 */
function printedRows(bytes: Uint8Array): Array<{ text: string; columns: number }> {
  const rows: Array<{ text: string; columns: number }> = [];
  let text = '';
  let columns = 0;
  let doubled = false;

  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte === 0x1b) {
      i += bytes[i + 1] === 0x40 ? 1 : 2;
      continue;
    }
    if (byte === 0x1d) {
      if (bytes[i + 1] === 0x21) doubled = (bytes[i + 2] & 0x10) !== 0;
      i += bytes[i + 1] === 0x56 ? 3 : 2;
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

describe('kitchen ticket layout', () => {
  it.each([
    ['58mm', profile58],
    ['80mm', profile80],
  ])('keeps every row within the paper width on %s', (_label, profile) => {
    for (const row of printedRows(buildKitchenTicket(ticket, profile))) {
      expect(row.columns).toBeLessThanOrEqual(profile.charsPerLine);
    }
  });

  it('prints the framed order header with the kitchen copy label', () => {
    const text = renderKitchenTicketText(ticket, profile58);

    expect(text).toContain('KITCHEN ORDER');
    expect(text).toContain('Date: 19-Aug-2026 2:30 PM');
    expect(text).toContain('Order No:');
    expect(text).toContain('42');
    expect(text).toContain('Kitchen Copy');
    expect(text).not.toContain('Customer Copy');
    expect(text).toContain('Dine-in');
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

  it('prints the customer for a takeaway and flags parcels on dine-out', () => {
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
    expect(takeaway).toContain('Takeaway');
    expect(takeaway).toContain('Sara');
    expect(takeaway).toContain('Phone: 0300 1112223');
    expect(takeaway).not.toContain('Table No');

    const dineOut = renderKitchenTicketText(
      {
        ...ticket,
        orderType: 'dine_out',
        items: [{ name: 'Biryani', quantity: 1, isParcel: true }],
      },
      profile58,
    );
    expect(dineOut).toContain('*** DINE-OUT + PARCEL ***');
    expect(dineOut).toContain('>> PARCEL');
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
