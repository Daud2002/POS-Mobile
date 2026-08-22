import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface PageFadeProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Page-enter transition: fade in while drifting up — the web app's
 * `animate-fade-in` keyframe (opacity 0 + translateY(8px) → 0, ease-out),
 * which it applies to nearly every page root.
 *
 * Fires on mount, so pushed screens animate on every open; tab scenes animate
 * on first visit and hand off to the tab navigator's shift animation after.
 */
export function PageFade({ children, style }: PageFadeProps) {
  return (
    <Animated.View entering={FadeInUp.duration(350)} style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}
