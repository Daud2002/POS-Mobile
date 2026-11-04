import { periodStart, salesRangeBounds } from '../periods';

// A fixed "now": 31 May 2024, mid-afternoon local time.
const now = new Date(2024, 4, 31, 14, 30);
const localMidnight = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day).toISOString();

describe('periodStart', () => {
  it('opens today at local midnight, not the UTC day', () => {
    expect(periodStart('today', now)).toBe(localMidnight(2024, 5, 31));
  });

  it('opens this month on the 1st', () => {
    expect(periodStart('thisMonth', now)).toBe(localMidnight(2024, 5, 1));
  });

  it('goes back whole calendar months, clamped to the shorter month', () => {
    // 31 May − 3 months would be 31 Feb: 29 Feb in a leap year.
    expect(periodStart('last3Months', now)).toBe(localMidnight(2024, 2, 29));
    // 31 May − 6 months would be 31 Nov: November has 30 days.
    expect(periodStart('last6Months', now)).toBe(localMidnight(2023, 11, 30));
  });

  it('crosses the year boundary going back', () => {
    expect(periodStart('last6Months', new Date(2024, 1, 15))).toBe(localMidnight(2023, 8, 15));
  });

  it('opens this year on 1 January', () => {
    expect(periodStart('thisYear', now)).toBe(localMidnight(2024, 1, 1));
  });

  it('has no lower bound for all time', () => {
    expect(periodStart('allTime', now)).toBeUndefined();
  });
});

describe('salesRangeBounds', () => {
  // Friday 31 May 2024, mid-afternoon local time (the `now` above).
  it('covers today as [midnight, next midnight)', () => {
    expect(salesRangeBounds('today', now)).toEqual({
      from: localMidnight(2024, 5, 31),
      to: localMidnight(2024, 6, 1),
    });
  });

  it('covers yesterday up to, not including, today', () => {
    expect(salesRangeBounds('yesterday', now)).toEqual({
      from: localMidnight(2024, 5, 30),
      to: localMidnight(2024, 5, 31),
    });
  });

  it('starts the week on Monday', () => {
    expect(salesRangeBounds('thisWeek', now).from).toBe(localMidnight(2024, 5, 27));
    // A Sunday belongs to the week that began six days earlier.
    expect(salesRangeBounds('thisWeek', new Date(2024, 5, 2, 9)).from).toBe(localMidnight(2024, 5, 27));
  });

  it('covers the whole of last month, across a year boundary', () => {
    expect(salesRangeBounds('lastMonth', new Date(2024, 0, 10))).toEqual({
      from: localMidnight(2023, 12, 1),
      to: localMidnight(2024, 1, 1),
    });
  });

  it('runs this month from the 1st through today', () => {
    expect(salesRangeBounds('thisMonth', now)).toEqual({
      from: localMidnight(2024, 5, 1),
      to: localMidnight(2024, 6, 1),
    });
  });
});
