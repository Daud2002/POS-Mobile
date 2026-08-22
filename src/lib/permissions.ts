import { PermissionsAndroid, Permission, Platform } from 'react-native';

export interface PermissionResult {
  granted: boolean;
  /** User-facing explanation of what is missing, when `granted` is false. */
  message?: string;
}

/**
 * Requests the Bluetooth permissions this OS version actually needs.
 *
 * Android split these at API 31:
 *  - 12+ (API 31+): BLUETOOTH_SCAN + BLUETOOTH_CONNECT are runtime permissions.
 *    BLUETOOTH_SCAN is declared with `neverForLocation`, since the app scans
 *    only for printers and never derives location from the results.
 *  - 11 and below: BLUETOOTH / BLUETOOTH_ADMIN are install-time, but scanning
 *    additionally requires ACCESS_FINE_LOCATION at runtime.
 *
 * iOS needs no runtime request — the system prompt is raised by CoreBluetooth
 * the first time the BLE manager is used, backed by
 * NSBluetoothAlwaysUsageDescription in app.config.ts.
 */
export async function requestBluetoothPermissions(): Promise<PermissionResult> {
  if (Platform.OS !== 'android') {
    return { granted: true };
  }

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;

  const required: Permission[] =
    apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  try {
    const results = await PermissionsAndroid.requestMultiple(required);
    const denied = required.filter(
      (permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED,
    );

    if (denied.length === 0) return { granted: true };

    const neverAskAgain = denied.some(
      (permission) => results[permission] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    );

    return {
      granted: false,
      message: neverAskAgain
        ? 'Bluetooth permission was permanently denied. Enable it in Settings › Apps › TapnTrade › Permissions.'
        : apiLevel >= 31
          ? 'Bluetooth permission is required to find and connect to your printer.'
          : 'Location permission is required — Android needs it to scan for Bluetooth devices on this version.',
    };
  } catch {
    return { granted: false, message: 'Could not request Bluetooth permissions.' };
  }
}
