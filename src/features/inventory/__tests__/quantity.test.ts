import {
  formatAmount,
  formatQuantity,
  formatSets,
  isLowStock,
  parseAmount,
  stockInTotal,
} from '../lib/quantity';

describe('formatSets', () => {
  it('reads whole bottles as sets plus loose bottles', () => {
    expect(formatSets(27, 6)).toBe('4 sets + 3');
    expect(formatSets(24, 6)).toBe('4 sets');
    expect(formatSets(6, 6)).toBe('1 set');
  });

  it('adds nothing below one set, when negative, or when fractional', () => {
    expect(formatSets(5, 6)).toBeNull();
    expect(formatSets(-12, 6)).toBeNull();
    expect(formatSets(12.5, 6)).toBeNull();
    expect(formatSets(12, 1)).toBeNull();
  });
});

describe('isLowStock', () => {
  it('flags at or below the threshold', () => {
    expect(isLowStock({ quantity: 1000, lowStockThreshold: 1000 })).toBe(true);
    expect(isLowStock({ quantity: 1001, lowStockThreshold: 1000 })).toBe(false);
  });

  it('never flags without a threshold, unless the count went negative', () => {
    expect(isLowStock({ quantity: 0, lowStockThreshold: null })).toBe(false);
    expect(isLowStock({ quantity: -1, lowStockThreshold: null })).toBe(true);
  });
});

describe('stockInTotal', () => {
  it('multiplies sets by the pack size for bottles only', () => {
    expect(stockInTotal({ unit: 'bottle', packSize: 6 }, 4, true)).toBe(24);
    expect(stockInTotal({ unit: 'bottle', packSize: 6 }, 4, false)).toBe(4);
    expect(stockInTotal({ unit: 'ml', packSize: 6 }, 500, true)).toBe(500);
  });
});

describe('formatting', () => {
  it('trims to three decimals and pluralises bottles', () => {
    expect(formatAmount(1.23456)).toBe('1.235');
    expect(formatAmount(2)).toBe('2');
    expect(formatQuantity(1, 'bottle')).toBe('1 bottle');
    expect(formatQuantity(250, 'ml')).toBe('250 ml');
  });

  it('parses decimal input, accepting a comma', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount(' ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});
