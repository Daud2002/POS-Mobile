import { Children, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** Width of each card inside the row. Wide enough for "Rs 1,234,567". */
const CARD_WIDTH = 170;

/**
 * Horizontally scrollable row of StatCards.
 *
 * StatCard is `flex: 1, minWidth: 150`, so three of them in a plain row need
 * 450pt+ and simply overflow a phone — the cards get clipped with no way to
 * reach them. Each child is given a fixed width inside a horizontal
 * ScrollView instead, so they keep their size and can be swiped.
 */
export function StatRow({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const items = Children.toArray(children).filter(Boolean);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Cancels Screen's page padding so the row bleeds to the edges, then
      // re-adds it inside — otherwise the first card looks inset and the last
      // one appears cut off rather than scrollable.
      style={{ marginHorizontal: -theme.spacing.lg }}
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      {items.map((child, index) => (
        <View key={index} style={{ width: CARD_WIDTH }}>
          {child}
        </View>
      ))}
    </ScrollView>
  );
}
