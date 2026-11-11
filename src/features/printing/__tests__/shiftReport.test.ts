import { shiftFigures } from '@/lib/shiftMaths';

import { EscPosBuilder } from '../escpos/builder';
import { decodePrintable } from '../templates/receipt.template';
import { buildShiftReport, ShiftReportData } from '../templates/shiftReport.template';
import { DEFAULT_PRINTER_PROFILE, PrinterProfile } from '../types';

const profile80: PrinterProfile = { ...DEFAULT_PRINTER_PROFILE };
const profile58: PrinterProfile = {
  ...DEFAULT_PRINTER_PROFILE,
  paperWidth: 58,
  charsPerLine: 32,
};

const base = {
  storeName: 'Karahi House',
  cashierName: 'Ali',
  openedAt: '2026-11-11T09:00:00Z',
  closedAt: '2026-11-11T17:00:00Z',
  openingFloat: 1000,
  orderCount: 4,
  cashPaidOut: 0,
  otherSales: 0,
};

/** A shift that recorded no tips, as a caller written before tips existed sends it. */
const untipped: ShiftReportData = {
  ...base,
  cashSales: 5000,
  cardSales: 2000,
  onlineSales: 0,
  totalSales: 7000,
  cashPaidOut: 400,
  expectedCash: 5600,
  countedCash: 5600,
  difference: 0,
};

/** The owner's example: 5,000 received in cash of which 300 is tips; 200 more by card and online. */
const tipped = (takenFromCash: boolean): ShiftReportData => ({
  ...base,
  cashSales: 4700,
  cardSales: 2600,
  onlineSales: 400,
  totalSales: 7700,
  cashTips: 300,
  cardTips: 120,
  onlineTips: 80,
  tipTotal: 500,
  tipsBreakdown: [
    { orderType: 'dine_in', method: 'cash', amount: 200 },
    { orderType: 'dine_in', method: 'online', amount: 80 },
    { orderType: 'takeaway', method: 'cash', amount: 100 },
    { orderType: 'delivery', method: 'card', amount: 120 },
  ],
  totalReceived: 8200,
  cashReceived: 5000,
  cashInDrawer: 6000,
  tipsFromDrawer: takenFromCash ? 200 : 0,
  tipsOwed: 0,
  expectedCash: takenFromCash ? 5500 : 5700,
  countedCash: takenFromCash ? 5500 : 5700,
  difference: 0,
});

const slip = (data: ShiftReportData, profile = profile80) =>
  decodePrintable(buildShiftReport(data, profile));

/** `label ... amount`, the whole of one printed line. */
const line = (label: string, amount: string) => {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`^${escape(label)} +${escape(amount)}$`, 'm');
};

/**
 * The template as it stood before tips existed, kept verbatim: a shift
 * without tips has to print the very same bytes it always did.
 */
function legacyShiftReport(data: ShiftReportData, profile: PrinterProfile): Uint8Array {
  const builder = new EscPosBuilder(profile);
  const money = (n: number | null | undefined) => Number(n ?? 0).toFixed(2);
  const time = (v?: string | Date | null) => (v ? new Date(v).toLocaleString() : '—');

  builder.init().align('center').bold(true).size(2, 2);
  builder.line('SHIFT REPORT');
  builder.size(1, 1).bold(false);
  if (data.storeName) builder.line(data.storeName);
  builder.align('left').divider('=');

  builder.row('Cashier', data.cashierName ?? '—');
  builder.row('Opened', time(data.openedAt));
  builder.row('Closed', time(data.closedAt));
  builder.row('Orders', String(data.orderCount ?? 0));
  builder.divider();

  builder.bold(true).line('TAKINGS').bold(false);
  builder.row('Cash', money(data.cashSales));
  builder.row('Card', money(data.cardSales));
  builder.row('Online', money(data.onlineSales));
  if (Number(data.otherSales) > 0) builder.row('Other', money(data.otherSales));
  builder.bold(true).row('Total sales', money(data.totalSales)).bold(false);
  builder.divider();

  builder.bold(true).line('CASH DRAWER').bold(false);
  builder.row('Opening float', money(data.openingFloat));
  builder.row('+ Cash sales', money(data.cashSales));
  builder.row('- Cash paid out', money(data.cashPaidOut));
  builder.bold(true).row('Expected in drawer', money(data.expectedCash)).bold(false);

  if (data.countedCash === null || data.countedCash === undefined) {
    builder.row('Counted', 'NOT COUNTED');
  } else {
    builder.row('Counted', money(data.countedCash));
    const diff = Number(data.difference ?? 0);
    const label = diff === 0 ? 'Balanced' : diff > 0 ? 'OVER' : 'SHORT';
    builder.bold(true).size(1, 2);
    builder.row(label, money(Math.abs(diff)));
    builder.size(1, 1).bold(false);
  }

  if (data.notes) {
    builder.divider();
    builder.wrapped(data.notes);
  }

  builder.divider('=');
  builder.newline();
  builder.line('Cashier: ______________________');
  builder.newline();
  builder.line('Received by: __________________');

  builder.feed(profile.autoCut ? 3 : 5);
  if (profile.autoCut) builder.cut();

  return builder.build();
}

describe('buildShiftReport', () => {
  it('prints the slip it always did for a shift without tips', () => {
    const out = slip(untipped);
    expect(out).toMatch(line('Total sales', '7000.00'));
    expect(out).toMatch(line('Opening float', '1000.00'));
    expect(out).toMatch(line('+ Cash sales', '5000.00'));
    expect(out).toMatch(line('- Cash paid out', '400.00'));
    expect(out).toMatch(line('Expected in drawer', '5600.00'));
    expect(out).not.toMatch(/tip/i);
    expect(out).not.toContain('hand over');
  });

  it('prints a shift without tips byte for byte as it did before tips existed', () => {
    const cases: ShiftReportData[] = [
      untipped,
      // Short, with the cashier's explanation.
      { ...untipped, countedCash: 5500, difference: -100, notes: 'Gave change from my own pocket' },
      // An owner's force-close: nobody counted the drawer.
      { ...untipped, countedCash: null, difference: null, cashierName: null, closedAt: null },
      // Cheques, which print a line of their own.
      { ...untipped, otherSales: 250, totalSales: 7250, storeName: undefined },
      // A server with tips sends the tip figures as zeros on such a shift.
      {
        ...untipped,
        cashTips: 0,
        cardTips: 0,
        onlineTips: 0,
        tipTotal: 0,
        tipsBreakdown: [],
        totalReceived: 7000,
        cashReceived: 5000,
        cashInDrawer: 5600,
        tipsFromDrawer: 0,
        tipsOwed: 0,
      },
    ];

    for (const data of cases) {
      for (const profile of [profile80, profile58, { ...profile58, autoCut: false }]) {
        expect(Array.from(buildShiftReport(data, profile))).toEqual(
          Array.from(legacyShiftReport(data, profile)),
        );
      }
    }
  });

  it('prints the same bytes for a closed shift without tips as the close sheet used to send', () => {
    const header = {
      storeName: 'Karahi House',
      cashierName: 'Ali',
      openedAt: '2026-11-11T09:00:00Z',
      closedAt: '2026-11-11T17:00:00Z',
    };
    const counted = { countedCash: 5550, difference: -50, notes: 'Gave change from my own pocket' };
    const sales = {
      cashSales: 5000, cardSales: 2000, onlineSales: 0, otherSales: 0, totalSales: 7000,
      orderCount: 3, cashPaidOut: 400, expectedCash: 5600,
    };
    // What the sheet built field by field before tips existed.
    const before: ShiftReportData = { ...header, openingFloat: 1000, ...sales, ...counted };

    const servers = [
      // One that predates tips: no tip figures anywhere.
      { openingFloat: 1000, totals: sales },
      // A current one, on a shift that took none.
      {
        openingFloat: 1000,
        totals: {
          ...sales,
          cashTips: 0, cardTips: 0, onlineTips: 0, tipTotal: 0, tipsBreakdown: [],
          totalReceived: 7000, cashReceived: 5000, cashInDrawer: 5600, tipsFromDrawer: 0, tipsOwed: 0,
        },
      },
    ];

    for (const closed of servers) {
      // What the sheet sends now: the stored figures, laid out by shiftFigures.
      const now: ShiftReportData = { ...header, ...shiftFigures(closed), ...counted };
      for (const profile of [profile80, profile58]) {
        expect(Array.from(buildShiftReport(now, profile))).toEqual(
          Array.from(legacyShiftReport(before, profile)),
        );
      }
    }
  });

  it('prints tips in a block of their own, never inside the sales', () => {
    const out = slip(tipped(true));
    // Sales are the bills.
    expect(out).toMatch(line('Cash', '4700.00'));
    expect(out).toMatch(line('Total sales', '7700.00'));
    // Tips, by order type and method, then the two totals the owner asked for.
    expect(out).toContain('TIPS (not in sales)');
    expect(out).toMatch(line('Dine-in / Cash', '200.00'));
    expect(out).toMatch(line('Dine-in / Online', '80.00'));
    expect(out).toMatch(line('Takeaway / Cash', '100.00'));
    expect(out).toMatch(line('Delivery / Card', '120.00'));
    expect(out).toMatch(line('Total tips', '500.00'));
    expect(out).toMatch(line('Total received', '8200.00'));
    expect(out.indexOf('TAKINGS')).toBeLessThan(out.indexOf('TIPS (not in sales)'));
    expect(out.indexOf('TIPS (not in sales)')).toBeLessThan(out.indexOf('CASH DRAWER'));
  });

  it('takes cash and card/online tips off the handover when they are paid from cash', () => {
    const out = slip(tipped(true));
    expect(out).toMatch(line('Opening float', '1000.00'));
    expect(out).toMatch(line('+ Cash received', '5000.00'));
    expect(out).toMatch(line('- Cash paid out', '0.00'));
    expect(out).toMatch(line('- Cash tips', '300.00'));
    expect(out).toMatch(line('- Card/online tips', '200.00'));
    expect(out).toMatch(line('Cash to hand over', '5500.00'));
    expect(out).not.toContain('Expected in drawer');
    expect(out).not.toContain('not taken from cash');
  });

  it('takes only cash tips off when they are not, and says where the rest went', () => {
    const out = slip(tipped(false));
    expect(out).toMatch(line('- Cash tips', '300.00'));
    expect(out).not.toContain('- Card/online tips');
    expect(out).toMatch(line('Cash to hand over', '5700.00'));
    // The note wraps to the paper, so it is read back with its lines joined.
    const flat = out.replace(/\n/g, ' ');
    expect(flat).toContain(
      'Card/online tips of 200.00 are not taken from cash. They come off the card/online money.',
    );
    // It sits in the drawer block: under the handover figure, before the count.
    expect(flat.indexOf('Cash to hand over')).toBeLessThan(flat.indexOf('not taken from cash'));
    expect(flat.indexOf('not taken from cash')).toBeLessThan(flat.indexOf('Counted'));
  });

  it('says what the drawer could not cover', () => {
    const out = slip({
      ...base,
      cashSales: 200,
      cardSales: 9000,
      onlineSales: 0,
      totalSales: 9200,
      cardTips: 1500,
      tipTotal: 1500,
      tipsBreakdown: [{ orderType: 'dine_in', method: 'card', amount: 1500 }],
      totalReceived: 10700,
      cashReceived: 200,
      cashInDrawer: 1200,
      tipsFromDrawer: 1500,
      tipsOwed: 300,
      expectedCash: 0,
      countedCash: 0,
      difference: 0,
    });
    expect(out).toMatch(line('- Card/online tips', '1200.00'));
    expect(out).toMatch(line('Cash to hand over', '0.00'));
    expect(out.replace(/\n/g, ' ')).toContain(
      'The drawer could not cover 300.00 of card/online tips. That is still owed to staff.',
    );
  });

  it('prints from the figures a closed shift is stored with', () => {
    // What CloseShiftSheet does with the server's response.
    const closed = {
      openingFloat: 1000,
      countedCash: 5500,
      difference: 0,
      totals: {
        cashSales: 4700, cardSales: 2600, onlineSales: 400, otherSales: 0, totalSales: 7700,
        orderCount: 4, cashPaidOut: 0, cashTips: 300, cardTips: 120, onlineTips: 80, tipTotal: 500,
        tipsBreakdown: [{ orderType: 'delivery', method: 'card', amount: 120 }],
        totalReceived: 8200, cashReceived: 5000, cashInDrawer: 6000, tipsFromDrawer: 200,
        tipsOwed: 0, expectedCash: 5500,
      },
    };
    const out = slip({
      ...shiftFigures(closed),
      countedCash: closed.countedCash,
      difference: closed.difference,
    });
    expect(out).toMatch(line('Orders', '4'));
    expect(out).toMatch(line('Delivery / Card', '120.00'));
    expect(out).toMatch(line('Total received', '8200.00'));
    expect(out).toMatch(line('Cash to hand over', '5500.00'));
    expect(out).toMatch(line('Balanced', '0.00'));
  });

  it.each([
    ['58mm', profile58],
    ['80mm', profile80],
  ])('keeps a tipped slip within the paper width, in plain ASCII, on %s', (_label, profile) => {
    for (const takenFromCash of [true, false]) {
      // No dates: how they print is the device locale's business, not the slip's.
      const data = { ...tipped(takenFromCash), openedAt: null, closedAt: null };
      const bytes = buildShiftReport(data, profile);
      const out = decodePrintable(bytes);

      for (const row of out.split('\n')) {
        expect(row.length).toBeLessThanOrEqual(profile.charsPerLine);
      }
      // Nothing clipped to fit, even on the narrow roll.
      expect(out).toMatch(line('Dine-in / Online', '80.00'));
      expect(out).toMatch(line('Total received', '8200.00'));
      expect(out).toMatch(line('- Cash tips', '300.00'));
      expect(out).toMatch(line('Cash to hand over', takenFromCash ? '5500.00' : '5700.00'));
      // No byte from a code page's upper half: "·" and "−" must not reach the
      // printer, which would print them as whatever glyph its page holds.
      expect(Array.from(bytes).filter((byte) => byte > 0x7e)).toEqual([]);
    }
  });
});
