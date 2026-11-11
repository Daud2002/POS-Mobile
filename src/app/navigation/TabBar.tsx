import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/theme/ThemeProvider';

const BAR_HEIGHT = 62;
/** Raised circle holding the active icon. */
const BUBBLE = 50;
/** Ring around the bubble, in the page background color — the "notch" trick. */
const HALO = BUBBLE + 14;
/** How far the halo pokes above the bar's top edge. */
const LIFT = HALO / 2 - 4;

/** The tablet's side rail: wide enough for "Dashboard" under its icon. */
const RAIL_WIDTH = 92;

/**
 * Bubble tab bar: a light rounded bar where the active tab's icon floats in a
 * raised circle above the bar, ringed by a halo in the page background color so
 * it reads as a cutout notch. Inactive tabs show a muted icon + label inside
 * the bar; the active tab shows only its label beneath the bubble.
 *
 * On a tablet the same tabs become a rail down the left edge (MainTabs moves
 * the bar there): a bar across the bottom of a wide window is a long reach
 * from either hand and takes height a tablet on its side cannot spare.
 */
export function TabBar(props: BottomTabBarProps) {
  const { isTablet } = useLayout();
  return isTablet ? <RailTabBar {...props} /> : <BubbleTabBar {...props} />;
}

function BubbleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    // Transparent strip above the bar gives the bubble room so nothing clips it.
    <View style={{ paddingTop: LIFT }}>
      <View
        style={[
          styles.bar,
          theme.shadows.lg,
          {
            backgroundColor: theme.colors.card,
            borderRadius: BAR_HEIGHT / 2,
            marginHorizontal: theme.spacing.lg,
            marginBottom: Math.max(insets.bottom, theme.spacing.md),
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.item}
            >
              {focused ? (
                <>
                  {/* Halo in the page background color creates the notch illusion.
                      Spring in on select, quick zoom out when leaving. */}
                  <Animated.View
                    entering={ZoomIn.springify().damping(13).stiffness(160)}
                    exiting={ZoomOut.duration(120)}
                    style={[
                      styles.halo,
                      { backgroundColor: theme.colors.background, top: -LIFT },
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        theme.shadows.md,
                        { backgroundColor: theme.colors.card },
                      ]}
                    >
                      {options.tabBarIcon?.({
                        focused,
                        color: theme.colors.primary,
                        size: 22,
                      })}
                    </View>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.duration(220)}>
                    <Text
                      variant="caption"
                      style={{
                        color: theme.colors.primary,
                        fontFamily: theme.fontFamily.bodySemibold,
                        marginBottom: 10,
                      }}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Animated.View>
                </>
              ) : (
                <View style={styles.inactive}>
                  {options.tabBarIcon?.({
                    focused,
                    color: theme.colors.mutedForeground,
                    size: 21,
                  })}
                  <Text
                    variant="caption"
                    color="mutedForeground"
                    style={{ marginTop: 3 }}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The rail: every tab as an icon over its label, top to bottom, with the
 * active one on a tinted tile. No bubble and no entrance animation — a rail is
 * furniture, and the eye should stay on the screen beside it.
 */
function RailTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.rail,
        {
          backgroundColor: theme.colors.card,
          borderRightColor: theme.colors.border,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.md,
          // The rail sits against the left edge, where a notch can be in landscape.
          paddingLeft: insets.left,
          width: RAIL_WIDTH + insets.left,
          gap: theme.spacing.xs,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.title ?? route.name;
        const color = focused ? theme.colors.primary : theme.colors.mutedForeground;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            style={[
              styles.railItem,
              {
                borderRadius: theme.radius.md,
                backgroundColor: focused ? theme.tint(theme.colors.primary, 0.12) : 'transparent',
              },
            ]}
          >
            {options.tabBarIcon?.({ focused, color, size: 22 })}
            <Text
              variant="caption"
              style={{
                color,
                fontFamily: focused ? theme.fontFamily.bodySemibold : theme.fontFamily.body,
                textAlign: 'center',
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  railItem: {
    width: RAIL_WIDTH - 16,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  halo: {
    position: 'absolute',
    alignSelf: 'center',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});
