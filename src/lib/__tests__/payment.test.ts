import {
  isSplitBalanced,
  parseSplit,
  paymentParts,
  paymentSummary,
  splitRemaining,
  takingsSummary,
} from '../payment';

const money = (n: number) => `Rs ${n}`;

describe('parseSplit', () => {
  it('reads the three boxes, treating blanks and junk as zero', () => {
    expect(parseSplit({ cash: '1000', card: '', online: 'abc' })).toEqual({
      cash: 1000, card: 0, online: 0,
    });
  });

  it('ignores negatives', () => {
    expect(parseSplit({ cash: '-5', card: '10', online: '' }).cash).toBe(0);
  });
});

describe('splitRemaining / isSplitBalanced', () => {
  it('says how much is still to allocate', () => {
    expect(splitRemaining(1650, { cash: 1000, card: 500, online: 0 })).toBe(150);
    expect(isSplitBalanced(1650, { cash: 1000, card: 500, online: 0 })).toBe(false);
  });

  it('goes negative when over-allocated', () => {
    expect(splitRemaining(100, { cash: 60, card: 60, online: 0 })).toBe(-20);
  });

  it('balances to the cent without floating-point noise', () => {
    expect(isSplitBalanced(0.3, { cash: 0.1, card: 0.2, online: 0 })).toBe(true);
  });
});

describe('paymentParts', () => {
  it('lists the non-zero parts of a split, and nothing for a single method', () => {
    expect(
      paymentParts({ paymentMethod: 'partial', paymentSplit: { cash: 1000, card: 650, online: 0 } }),
    ).toEqual([
      { method: 'cash', label: 'Cash', amount: 1000 },
      { method: 'card', label: 'Card', amount: 650 },
    ]);
    expect(paymentParts({ paymentMethod: 'card' })).toEqual([]);
  });
});

describe('paymentSummary', () => {
  it('names a single method', () => {
    expect(paymentSummary({ paymentMethod: 'card' }, money)).toBe('Card');
  });

  it('spells out a split with its amounts', () => {
    expect(
      paymentSummary(
        { paymentMethod: 'partial', paymentSplit: { cash: 1000, card: 650, online: 0 } },
        money,
      ),
    ).toBe('Cash Rs 1000 · Card Rs 650');
  });

  it('falls back to the stored columns when the split object is absent', () => {
    expect(
      paymentSummary(
        { paymentMethod: 'partial', paidCash: '500.00', paidCard: '0', paidOnline: '250.00' },
        money,
      ),
    ).toBe('Cash Rs 500 · Online Rs 250');
  });

  it('is null while unpaid', () => {
    expect(paymentSummary({ paymentMethod: null }, money)).toBeNull();
  });

  it('adds a tip on the end, after the bill', () => {
    expect(paymentSummary({ paymentMethod: 'card', tipAmount: '150.00', tipMethod: 'card' }, money)).toBe(
      'Card · Tip Rs 150',
    );
    // No tip, no mention — including the "0.00" every untipped order carries.
    expect(paymentSummary({ paymentMethod: 'card', tipAmount: '0.00', tipMethod: null }, money)).toBe('Card');
  });

  it('names the tip’s method when the payment does not already say it', () => {
    expect(paymentSummary({ paymentMethod: 'card', tipAmount: 100, tipMethod: 'cash' }, money)).toBe(
      'Card · Tip Rs 100 (Cash)',
    );
    expect(
      paymentSummary(
        {
          paymentMethod: 'partial',
          paymentSplit: { cash: 600, card: 400, online: 0 },
          tipAmount: 80,
          tipMethod: 'card',
        },
        money,
      ),
    ).toBe('Cash Rs 600 · Card Rs 400 · Tip Rs 80 (Card)');
  });

  it('reads the same as before tips for an order from a server that sends no tip fields', () => {
    expect(paymentSummary({ paymentMethod: 'cash' }, money)).toBe('Cash');
    expect(
      paymentSummary({ paymentMethod: 'partial', paymentSplit: { cash: 0, card: 0, online: 0 } }, money),
    ).toBe('Split');
  });
});

describe('takingsSummary', () => {
  it('lists every method, zeros included, from the stored decimal strings', () => {
    expect(
      takingsSummary({ cashSales: '600.00', cardSales: '250.00', onlineSales: '0.00' }, money),
    ).toBe('Cash Rs 600 · Card Rs 250 · Online Rs 0');
  });

  it('is null for an open shift whose figures are not frozen yet', () => {
    expect(takingsSummary({ cashSales: null, cardSales: null, onlineSales: null }, money)).toBeNull();
    expect(takingsSummary({}, money)).toBeNull();
  });
});
