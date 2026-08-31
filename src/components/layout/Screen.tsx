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
}

/**
 * Standard screen container: themed background, safe-area insets, and the
 * web app's page rhythm (`space-y-6` between sections, 16px page padding).
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
}: ScreenProps) {
  const theme = useTheme();

  const content: StyleProp<ViewStyle> = [
    { padding: theme.spacing[padding], gap: theme.spacing['2xl'] },
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
            {footer}
          </View>
        ) : null}
      </PageFade>
    </SafeAreaView>
  );
}
