import { createMMKV } from 'react-native-mmkv';

/**
 * Synchronous key-value storage for non-sensitive local state: theme choice,
 * printer profile, cached cart.
 *
 * The JWT does NOT belong here — it lives in expo-secure-store, see
 * src/lib/secureStorage.ts.
 */
const mmkv = createMMKV({ id: 'tapntrade' });

export const StorageKey = {
  themeMode: 'theme.mode',
  printerProfile: 'printer.profile',
  cartDraft: 'pos.cartDraft',
} as const;

export type StorageKeyName = (typeof StorageKey)[keyof typeof StorageKey];

export const storage = {
  getString(key: StorageKeyName): string | undefined {
    return mmkv.getString(key);
  },

  setString(key: StorageKeyName, value: string): void {
    mmkv.set(key, value);
  },

  /** Reads and parses JSON, returning `null` when absent or corrupt. */
  getObject<T>(key: StorageKeyName): T | null {
    const raw = mmkv.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // A malformed value is more likely a schema change than a real error —
      // drop it rather than crashing the screen that reads it.
      mmkv.remove(key);
      return null;
    }
  },

  setObject(key: StorageKeyName, value: unknown): void {
    mmkv.set(key, JSON.stringify(value));
  },

  remove(key: StorageKeyName): void {
    mmkv.remove(key);
  },
};
