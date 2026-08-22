import { StatusBar } from 'expo-status-bar';

import { RootNavigator } from '@/app/navigation/RootNavigator';
import { AppProviders } from '@/app/providers/AppProviders';
import { AnimatedSplash } from '@/app/providers/AnimatedSplash';
import { FontGate } from '@/app/providers/FontGate';
import { useThemeMode } from '@/theme/ThemeProvider';

/**
 * TapnTrade mobile — POS and store management for cashiers and store owners.
 *
 * Requires a Dev Client build: the Bluetooth printer transports use native
 * modules that Expo Go cannot load.
 *   npx expo prebuild --clean && npx expo run:android
 */
export default function App() {
  return (
    <FontGate>
      <AppProviders>
        <ThemedStatusBar />
        {/*
          Inside the providers so the navigator mounts underneath while the
          splash plays — the first screen is laid out by the time it fades.
        */}
        <AnimatedSplash>
          <RootNavigator />
        </AnimatedSplash>
      </AppProviders>
    </FontGate>
  );
}

/** Inside the providers so it can follow the resolved theme. */
function ThemedStatusBar() {
  const { isDark } = useThemeMode();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
