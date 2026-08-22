import { ReactNode, useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { LOGO_SOURCE } from '@/components/ui/Logo';

/** Must match `backgroundColor` on the expo-splash-screen plugin exactly. */
export const SPLASH_BACKGROUND = '#FFFFFF';

const LOGO_SIZE = 160;

const RISE_MS = 700;
const HOLD_MS = 450;
const FADE_MS = 380;

/**
 * Branded launch animation: the logo rises from the bottom of the screen to
 * the centre, holds, then the whole overlay fades to reveal the app.
 *
 * It renders as an overlay ON TOP of `children` rather than replacing them, so
 * the navigator mounts underneath while the animation plays — by the time the
 * overlay fades out the first screen is already laid out, with no flash of an
 * empty frame.
 *
 * The native splash is configured with a blank image and this same background
 * colour, so the hand-off is invisible: the background never changes, only the
 * logo arrives.
 */
export function AnimatedSplash({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  const [finished, setFinished] = useState(false);

  // Start just off the bottom edge, measured from the centred rest position.
  const translateY = useSharedValue(height / 2 + LOGO_SIZE);
  const logoOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

  const done = useCallback(() => setFinished(true), []);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: RISE_MS,
      // Decelerating: fast off the bottom, settling gently at the centre.
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });

    logoOpacity.value = withTiming(1, { duration: RISE_MS * 0.5 });

    overlayOpacity.value = withSequence(
      withDelay(RISE_MS + HOLD_MS, withTiming(1, { duration: 0 })),
      withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (completed) => {
        // Unmount only once the fade actually finished; an interrupted
        // animation must not leave a transparent overlay swallowing taps.
        if (completed) runOnJS(done)();
      }),
    );
    // Runs once on mount; the shared values are stable refs.
  }, [translateY, logoOpacity, overlayOpacity, done]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.root}>
      {children}

      {/*
        The overlay is left touch-capturing on purpose: the navigator is
        already mounted underneath, and a stray tap during the animation would
        otherwise land on a real control. It unmounts once the fade completes.
      */}
      {!finished && (
        <Animated.View
          style={[styles.overlay, { backgroundColor: SPLASH_BACKGROUND }, overlayStyle]}
        >
          <Animated.Image
            source={LOGO_SOURCE}
            style={[styles.logo, logoStyle]}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
