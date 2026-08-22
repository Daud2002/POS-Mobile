import type { ExpoConfig } from 'expo/config';

/**
 * Expo app configuration.
 *
 * Native Bluetooth modules (react-native-ble-plx, react-native-bluetooth-classic)
 * cannot run in Expo Go — this app requires a Dev Client build:
 *   npx expo prebuild --clean && npx expo run:android
 */
const config: ExpoConfig = {
  name: 'TapnTrade',
  slug: 'tapntrade',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'tapntrade',
  // Splash is configured through the expo-splash-screen plugin below; SDK 54+
  // no longer accepts a top-level `splash` key.
  userInterfaceStyle: 'automatic',

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'store.tapntrade.pos',
    infoPlist: {
      // Required for BLE thermal printers. Bluetooth Classic (SPP) printers are
      // Android-only — iOS requires MFi certification, which generic ESC/POS
      // printers do not have. See PrinterSetupScreen for the platform gating.
      NSBluetoothAlwaysUsageDescription:
        'TapnTrade connects to your Bluetooth receipt printer to print sales receipts.',
      NSCameraUsageDescription:
        'TapnTrade uses the camera to scan product barcodes at checkout.',
    },
  },

  android: {
    package: 'store.tapntrade.pos',
    adaptiveIcon: {
      // The mark is dark navy, so it needs a light ground to read at all.
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      // Android 12+ (API 31+)
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      // Android 11 and below
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.CAMERA',
    ],
  },

  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    // Single-page output: the app is a native-first SPA, not a static site.
    output: 'single',
  },

  plugins: [
    'expo-dev-client',
    'expo-secure-store',
    'expo-font',
    'expo-sharing',
    [
      'expo-splash-screen',
      {
        /**
         * Intentionally a blank image: the native splash paints the brand
         * background only, and AnimatedSplash then flies the logo up from the
         * bottom. Pointing this at the real artwork would draw the logo
         * centred first, so the animation would start with a visible jump.
         */
        image: './assets/splash-blank.png',
        backgroundColor: '#FFFFFF',
        imageWidth: 16,
      },
    ],
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: false,
        // We only scan for printers, never to infer location.
        neverForLocation: true,
        modes: ['peripheral'],
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'TapnTrade uses the camera to scan product barcodes.',
      },
    ],
  ],

  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api',
    eas: {
      projectId: 'b8a40d60-b167-4d95-8977-6c0741c7577a',
    },
  },
};

export default config;
