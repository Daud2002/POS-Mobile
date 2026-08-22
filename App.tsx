import { StatusBar } from 'expo-status-bar';

import { RootNavigator } from '@/app/navigation/RootNavigator';
import { AppProviders } from '@/app/providers/AppProviders';
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
        <RootNavigator />
      </AppProviders>
    </FontGate>
  );
}

/** Inside the providers so it can follow the resolved theme. */
function ThemedStatusBar() {
  const { isDark } = useThemeMode();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
