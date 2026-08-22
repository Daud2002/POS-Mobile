import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { ReactNode, useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { SPLASH_BACKGROUND } from './AnimatedSplash';

// Keep the splash up until the fonts are ready, so no frame renders in the
// system font and then reflows.
void SplashScreen.preventAutoHideAsync();

/**
 * Loads Space Grotesk (headings) and DM Sans (body) — the same pair the web app
 * pulls from Google Fonts. Keys must match `fontFamily` in theme/typography.ts.
 */
export function FontGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    // A font failure must not brick the app — fall through to system fonts.
    if (loaded || error) void hideSplash();
  }, [loaded, error, hideSplash]);

  if (!loaded && !error) {
    // Same colour as the native splash and AnimatedSplash, so the hand-off
    // between the three is invisible.
    return <View style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND }} />;
  }

  return <>{children}</>;
}
