import { ReactNode } from 'react';
import { View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { CONTENT_WIDTH, type ContentWidth } from '@/lib/responsive';

/**
 * The centred column of a tablet, for screens that build their own layout
 * (a search box over a FlatList, with a floating add button) instead of going
 * through <Screen>.
 *
 * On a phone it renders its children untouched — no wrapper at all. On a
 * tablet it holds them to a readable width in the middle of the window, so a
 * list row is not stretched across a thousand points and the add button sits
 * at the corner of the list rather than the far corner of the screen.
 */
export function ContentColumn({
  children,
  width = 'list',
}: {
  children: ReactNode;
  width?: Exclude<ContentWidth, 'full'>;
}) {
  const { isTablet } = useLayout();
  if (!isTablet) return <>{children}</>;

  return (
    <View style={{ flex: 1, width: '100%', maxWidth: CONTENT_WIDTH[width], alignSelf: 'center' }}>
      {children}
    </View>
  );
}
