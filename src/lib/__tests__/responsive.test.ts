import {
  BREAKPOINTS,
  CONTENT_WIDTH,
  columnsFor,
  dialogWidthFor,
  itemWidthFor,
  sizeClassOf,
} from '../responsive';

describe('sizeClassOf', () => {
  it('calls every phone held upright compact', () => {
    // iPhone SE, iPhone 15, iPhone 16 Pro Max, a large Android phone.
    for (const width of [320, 375, 393, 440, 480]) expect(sizeClassOf(width)).toBe('compact');
    expect(sizeClassOf(BREAKPOINTS.medium - 1)).toBe('compact');
  });

  it('calls a small tablet, or a large one upright, medium', () => {
    // 7" Android tablet, iPad mini, iPad, iPad Air 11" — all upright.
    for (const width of [600, 744, 768, 820, 834]) expect(sizeClassOf(width)).toBe('medium');
  });

  it('calls a large tablet on its side expanded', () => {
    // iPad landscape, iPad Air 11" landscape, iPad Pro 13" landscape.
    for (const width of [1024, 1180, 1366]) expect(sizeClassOf(width)).toBe('expanded');
    expect(sizeClassOf(BREAKPOINTS.expanded)).toBe('expanded');
  });

  it('treats an iPad in a narrow Split View as a phone', () => {
    expect(sizeClassOf(320)).toBe('compact');
    expect(sizeClassOf(507)).toBe('compact');
  });
});

describe('columnsFor', () => {
  it('fits as many columns of the minimum width as the space allows', () => {
    // Table tiles (128 wide, 8 apart) across a tablet on its side.
    expect(columnsFor(1056, 128, 8)).toBe(7);
    // Kitchen tickets (300 wide, 12 apart): two upright, three sideways.
    expect(columnsFor(696, 300, 12)).toBe(2);
    expect(columnsFor(1056, 300, 12)).toBe(3);
  });

  it('counts the gaps, not just the tiles', () => {
    // Three tiles of 100 need 320 with two gaps of 10, not 300.
    expect(columnsFor(319, 100, 10)).toBe(2);
    expect(columnsFor(320, 100, 10)).toBe(3);
  });

  it('never drops below one column or above the cap', () => {
    expect(columnsFor(80, 300, 12)).toBe(1);
    expect(columnsFor(0, 300, 12)).toBe(1);
    expect(columnsFor(5000, 100, 0, 4)).toBe(4);
  });
});

describe('itemWidthFor', () => {
  it('splits the space evenly after the gaps', () => {
    expect(itemWidthFor(1056, 3, 12)).toBe(344);
    expect(itemWidthFor(320, 3, 10)).toBe(100);
  });

  it('rounds down so the last tile of a row never wraps', () => {
    const width = itemWidthFor(1000, 3, 8);
    expect(width).toBe(328);
    expect(width * 3 + 8 * 2).toBeLessThanOrEqual(1000);
  });

  it('gives a single column the whole space', () => {
    expect(itemWidthFor(500, 1, 12)).toBe(500);
  });
});

describe('dialogWidthFor', () => {
  it('uses the preferred width when the window has room', () => {
    expect(dialogWidthFor(1180, 560)).toBe(560);
    expect(dialogWidthFor(1180, 780)).toBe(780);
  });

  it('leaves a margin either side on a narrower window', () => {
    // A 780 dialog on a small tablet upright: the window less 24 each side.
    expect(dialogWidthFor(600, 780)).toBe(552);
  });
});

describe('CONTENT_WIDTH', () => {
  it('runs from a form to a page, each wider than the last', () => {
    expect(CONTENT_WIDTH.form).toBeLessThan(CONTENT_WIDTH.list);
    expect(CONTENT_WIDTH.list).toBeLessThan(CONTENT_WIDTH.page);
    // A content column is only ever applied on a tablet, so each must be at
    // least as wide as the narrowest tablet window.
    expect(CONTENT_WIDTH.list).toBeGreaterThanOrEqual(BREAKPOINTS.medium);
  });
});
