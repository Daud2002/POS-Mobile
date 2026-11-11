import { useCallback, useState } from 'react';
import { DimensionValue, LayoutChangeEvent, useWindowDimensions } from 'react-native';

import { columnsFor, itemWidthFor, sizeClassOf, type SizeClass } from '@/lib/responsive';

export interface Layout {
  width: number;
  height: number;
  sizeClass: SizeClass;
  /** A window wide enough for tablet layouts. False on every phone held upright. */
  isTablet: boolean;
  /** A large tablet on its side. */
  isExpanded: boolean;
  isLandscape: boolean;
}

/**
 * The window's size class, live: it changes when a tablet is turned, or when
 * the app is put into Split View. Screens branch on `isTablet` and leave the
 * phone layout exactly as it is.
 */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const sizeClass = sizeClassOf(width);
  return {
    width,
    height,
    sizeClass,
    isTablet: sizeClass !== 'compact',
    isExpanded: sizeClass === 'expanded',
    isLandscape: width > height,
  };
}

/**
 * How wide each tile of a wrapping grid should be.
 *
 * On a phone the tile keeps the width it always had (`compactItemWidth`, e.g.
 * '48%') and nothing is measured. On a tablet the grid's own width is
 * measured and split into as many equal columns of at least `minItemWidth`
 * as fit, so the same grid shows three tiles on a small tablet and six on a
 * large one turned sideways.
 *
 *   const grid = useGrid({ minItemWidth: 150, gap: 8, compactItemWidth: '48%' });
 *   <View style={styles.grid} onLayout={grid.onLayout}>
 *     <Tile style={{ width: grid.itemWidth }} />
 */
export function useGrid({
  minItemWidth,
  gap,
  compactItemWidth,
  maxColumns,
}: {
  minItemWidth: number;
  gap: number;
  compactItemWidth: DimensionValue;
  maxColumns?: number;
}): {
  onLayout: ((event: LayoutChangeEvent) => void) | undefined;
  itemWidth: DimensionValue;
  columns: number | undefined;
} {
  const { isTablet } = useLayout();
  const [available, setAvailable] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setAvailable((current) => (current === next ? current : next));
  }, []);

  if (!isTablet) return { onLayout: undefined, itemWidth: compactItemWidth, columns: undefined };

  const columns = columnsFor(available, minItemWidth, gap, maxColumns);
  return {
    onLayout,
    // Until the first measurement lands, the phone width keeps the tiles
    // visible rather than collapsed.
    itemWidth: available > 0 ? itemWidthFor(available, columns, gap) : compactItemWidth,
    columns,
  };
}
