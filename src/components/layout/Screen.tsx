import { ReactNode, RefObject } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useLayout } from '@/hooks/useLayout';
import { CONTENT_WIDTH, type ContentWidth } from '@/lib/responsive';
import { Spacing } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

import { PageFade } from './PageFade';

interface ScreenProps {
  children: ReactNode;
  /** Wraps content in a ScrollView. Turn off for FlatList-based screens. */
  scrollable?: boolean;
  /** Enables pull-to-refresh; only applies when `scrollable`. */
  onRefresh?: () => void;
  refreshing?: boolean;
  padding?: Spacing;
  edges?: readonly Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Docked to the bottom of the VIEWPORT, outside the scroll area — for an
   * action that must stay reachable however far the content has scrolled.
   *
   * A flex sibling rather than an absolute overlay, so it can never cover the
   * last rows of the list behind it.
   */
  footer?: ReactNode;
  /** Lets a screen scroll programmatically, e.g. to a section it just revealed. */
  scrollRef?: RefObject<ScrollView | null>;
  /**
   * How wide the content may grow on a TABLET before it stops and centres:
   * 'form', 'list' (the default), 'page' for dashboards, or 'full' for work
   * screens that use the whole window. A phone ignores it — its content is
   * always the width of the screen.
   */
  width?: ContentWidth;
}

/**
 * Standard screen container: themed background, safe-area insets, and the
 * web app's page rhythm (`space-y-6` between sections, 16px page padding).
 *
 * On a tablet the content is held to a centred column (`width`) instead of
 * stretching edge to edge; the background, the scroll area and the footer bar
 * still span the window.
 */
export function Screen({
  children,
  scrollable = false,
  onRefresh,
  refreshing = false,
  padding = 'lg',
  edges = ['bottom'],
  contentStyle,
  footer,
  scrollRef,
  width = 'list',
}: ScreenProps) {
  const theme = useTheme();
  const { isTablet } = useLayout();

  /** The centred column of a tablet. Null on a phone, and for 'full' screens. */
  const column: ViewStyle | null =
    isTablet && width !== 'full'
      ? { width: '100%', maxWidth: CONTENT_WIDTH[width], alignSelf: 'center' }
      : null;

  const content: StyleProp<ViewStyle> = [
    { padding: theme.spacing[padding], gap: theme.spacing['2xl'] },
    column,
    contentStyle,
  ];

  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <PageFade>
        {scrollable ? (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, content]}>{children}</View>
        )}
        {footer ? (
          <View
            style={{
              paddingHorizontal: theme.spacing[padding],
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.background,
            }}
          >
            {/* The bar spans the window; what is in it lines up with the column above. */}
            {column ? <View style={column}>{footer}</View> : footer}
          </View>
        ) : null}
      </PageFade>
    </SafeAreaView>
  );
}
