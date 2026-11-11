import {
  drawerNotes,
  drawerRows,
  handoverLabel,
  hasTips,
  shiftFigures,
  takingsRows,
  tipsOutOfDrawer,
} from '../shiftMaths';

const money = (n: number) => `Rs ${n}`;

/**
 * The owner's worked example, as the server sends it: opening float 1,000 and
 * 5,000 received in cash of which 300 is tips; 200 of tips by card and online.
 */
const totals = (takenFromCash: boolean) => ({
  cashSales: 4700,
  cardSales: 2600,
  onlineSales: 400,
  otherSales: 0,
  totalSales: 7700,
  orderCount: 4,
  cashPaidOut: 0,
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
});

const shift = (takenFromCash: boolean) => ({ openingFloat: 1000, totals: totals(takenFromCash) });
const rows = (figures: ReturnType<typeof shiftFigures>) =>
  drawerRows(figures).map((r) => `${r.sign} ${r.label} ${r.amount}`.trim());

describe('shiftFigures', () => {
  it('takes the server’s figures as they are', () => {
    const figures = shiftFigures(shift(true));
    expect(figures).toMatchObject({
      openingFloat: 1000,
      totalSales: 7700,
      tipTotal: 500,
      totalReceived: 8200,
      cashReceived: 5000,
      cashInDrawer: 6000,
      expectedCash: 5500,
    });
    expect(figures.tipsBreakdown).toHaveLength(4);
    expect(hasTips(figures)).toBe(true);
  });

  it('fills in what a server without tips does not send', () => {
    const figures = shiftFigures({
      openingFloat: '1000.00',
      totals: {
        cashSales: 5000, cardSales: 2000, onlineSales: 0, otherSales: 0, totalSales: 7000,
        orderCount: 3, cashPaidOut: 400, expectedCash: 5600,
      },
    });
    expect(figures).toMatchObject({
      tipTotal: 0,
      tipsBreakdown: [],
      totalReceived: 7000,
      cashReceived: 5000,
      cashInDrawer: 5600,
      tipsFromDrawer: 0,
      expectedCash: 5600,
    });
    expect(hasTips(figures)).toBe(false);
  });

  it('reads a closed shift’s own columns when the row carries no totals', () => {
    const figures = shiftFigures({
      openingFloat: 1000,
      cashSales: '4700.00', cardSales: '2600.00', onlineSales: '400.00', totalSales: '7700.00',
      cashPaidOut: '0.00', cashTips: '300.00', cardTips: '120.00', onlineTips: '80.00',
      tipsFromDrawer: '200.00', expectedCash: '5500.00',
      tipBreakdown: [{ orderType: 'delivery', method: 'card', amount: 120 }],
    });
    expect(figures).toMatchObject({ tipTotal: 500, cashInDrawer: 6000, expectedCash: 5500 });
    expect(figures.tipsBreakdown).toEqual([{ orderType: 'delivery', method: 'card', amount: 120 }]);
  });

  it('is all zeros for no shift at all', () => {
    expect(shiftFigures(null)).toMatchObject({ totalSales: 0, tipTotal: 0, expectedCash: 0 });
  });
});

describe('takingsRows', () => {
  it('reads across: received, of which tips, leaving sales', () => {
    expect(takingsRows(shiftFigures(shift(true)))).toEqual([
      { key: 'cash', label: 'Cash', received: 5000, tips: 300, sales: 4700 },
      { key: 'card', label: 'Card', received: 2720, tips: 120, sales: 2600 },
      { key: 'online', label: 'Online', received: 480, tips: 80, sales: 400 },
      { key: 'total', label: 'Total', received: 8200, tips: 500, sales: 7700 },
    ]);
  });

  it('lists cheques only when there are any', () => {
    const withOther = shiftFigures({ totals: { ...totals(true), otherSales: 250, totalSales: 7950 } });
    expect(takingsRows(withOther).map((r) => r.key)).toEqual(['cash', 'card', 'online', 'other', 'total']);
  });
});

describe('the drawer', () => {
  it('takes cash and card/online tips out when the store pays them from cash: 5,500', () => {
    const figures = shiftFigures(shift(true));
    expect(rows(figures)).toEqual([
      'Opening float 1000',
      '+ Cash received 5000',
      '− Cash paid out 0',
      '− Cash tips 300',
      '− Card/online tips 200',
      'Cash to hand over 5500',
    ]);
    expect(tipsOutOfDrawer(figures)).toBe(500);
    expect(drawerNotes(figures, money)).toEqual([]);
  });

  it('takes only cash tips out when it does not, and says where the rest went: 5,700', () => {
    const figures = shiftFigures(shift(false));
    expect(rows(figures)).toEqual([
      'Opening float 1000',
      '+ Cash received 5000',
      '− Cash paid out 0',
      '− Cash tips 300',
      'Cash to hand over 5700',
    ]);
    expect(tipsOutOfDrawer(figures)).toBe(300);
    expect(drawerNotes(figures, money)).toEqual([
      'Card/online tips of Rs 200 are not taken from cash. They come off the card/online money.',
    ]);
  });

  it('keeps the old three lines and wording on a shift without tips', () => {
    const figures = shiftFigures({
      openingFloat: 1000,
      totals: { cashSales: 5000, totalSales: 5000, cashPaidOut: 400, expectedCash: 5600 },
    });
    expect(rows(figures)).toEqual([
      'Opening float 1000',
      '+ Cash sales 5000',
      '− Cash paid out 400',
      'Should be in drawer 5600',
    ]);
    expect(handoverLabel(figures)).toBe('Should be in drawer');
    expect(tipsOutOfDrawer(figures)).toBe(0);
    expect(drawerNotes(figures, money)).toEqual([]);
  });

  it('shows only what the drawer could cover, and what is still owed', () => {
    // 1,200 in the drawer, 1,500 of card tips due from it.
    const figures = shiftFigures({
      openingFloat: 1000,
      totals: {
        cashSales: 200, totalSales: 200, cashPaidOut: 0, cardTips: 1500, tipTotal: 1500,
        cashReceived: 200, cashInDrawer: 1200, tipsFromDrawer: 1500, tipsOwed: 300, expectedCash: 0,
      },
    });
    expect(rows(figures)).toEqual([
      'Opening float 1000',
      '+ Cash received 200',
      '− Cash paid out 0',
      '− Card/online tips 1200',
      'Cash to hand over 0',
    ]);
    expect(drawerNotes(figures, money)).toEqual([
      'The drawer could not cover Rs 300 of card/online tips. That is still owed to staff.',
    ]);
  });
});
