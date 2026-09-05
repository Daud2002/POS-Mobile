import { compareBySortOrder, parseSortOrderInput, sortBySortOrder } from '../sortOrder';

const named = (name: string, sortOrder?: number | string | null) => ({ name, sortOrder });

describe('sortBySortOrder', () => {
  it('orders by the number, lowest first', () => {
    const rows = [named('a', 5), named('b', 9), named('c', 2), named('d', 66)];
    expect(sortBySortOrder(rows).map((r) => r.sortOrder)).toEqual([2, 5, 9, 66]);
  });

  it('keeps that order after a filter, not the original one', () => {
    const rows = [named('a', 5), named('b', 9), named('c', 2), named('d', 66)];
    const filtered = rows.filter((r) => r.sortOrder !== 9);
    expect(sortBySortOrder(filtered).map((r) => r.sortOrder)).toEqual([2, 5, 66]);
  });

  /** Rows written before the column existed have no number. */
  it('puts unnumbered rows last, alphabetically', () => {
    const rows = [named('zed', null), named('mid', 3), named('alpha', undefined), named('top', 1)];
    expect(sortBySortOrder(rows).map((r) => r.name)).toEqual(['top', 'mid', 'alpha', 'zed']);
  });

  it('tolerates the number arriving as a string', () => {
    const rows = [named('a', '10'), named('b', 2)];
    expect(sortBySortOrder(rows).map((r) => r.name)).toEqual(['b', 'a']);
  });

  it('does not mutate its input', () => {
    const rows = [named('a', 2), named('b', 1)];
    sortBySortOrder(rows);
    expect(rows.map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('treats 0 as a real position, ahead of 1', () => {
    expect(compareBySortOrder(named('a', 0), named('b', 1))).toBeLessThan(0);
  });
});

describe('parseSortOrderInput', () => {
  it('reads a whole number', () => {
    expect(parseSortOrderInput(' 12 ')).toBe(12);
    expect(parseSortOrderInput('0')).toBe(0);
  });

  it('treats blank as no preference', () => {
    expect(parseSortOrderInput('')).toBeUndefined();
    expect(parseSortOrderInput('   ')).toBeUndefined();
  });

  it('rejects anything that is not a whole non-negative number', () => {
    expect(parseSortOrderInput('-1')).toBeNull();
    expect(parseSortOrderInput('1.5')).toBeNull();
    expect(parseSortOrderInput('abc')).toBeNull();
  });
});
