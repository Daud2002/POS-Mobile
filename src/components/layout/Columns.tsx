import { Children, ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { useGrid } from '@/hooks/useLayout';

interface ColumnsProps {
  children: ReactNode;
  /** The narrowest a column may be; as many as fit are used. */
  minItemWidth?: number;
  /** Space between columns and between rows. Match the gap the stacked list uses. */
  gap?: number;
  maxColumns?: number;
  /**
   * Stretch every card in a row to the tallest one. Off by default: cards of
   * different lengths (kitchen tickets) keep their own height.
   */
  equalHeight?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A stack on a phone, side-by-side columns on a tablet.
 *
 * On a phone this renders its children untouched — no wrapper, so the list
 * they sit in spaces them exactly as it always did. On a tablet the same
 * children flow left to right into as many equal columns as fit, which is
 * what turns a long single file of cards into a board.
 */
export function Columns({
  children,
  minItemWidth = 320,
  gap = 12,
  maxColumns,
  equalHeight = false,
  style,
}: ColumnsProps) {
  const grid = useGrid({ minItemWidth, gap, compactItemWidth: '100%', maxColumns });

  // A phone: `onLayout` is only handed out on a tablet.
  if (!grid.onLayout) return <>{children}</>;

  const items = Children.toArray(children);

  return (
    <View
      onLayout={grid.onLayout}
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
          alignItems: equalHeight ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {items.map((child, index) => (
        <View
          key={(child as { key?: string | null }).key ?? index}
          style={[{ width: grid.itemWidth }, equalHeight ? { display: 'flex' } : null]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
