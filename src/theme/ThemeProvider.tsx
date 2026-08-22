import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { StorageKey, storage } from '@/lib/storage';

import { darkTheme, lightTheme, Theme } from './theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  /** The user's stored preference, which may be 'system'. */
  mode: ThemeMode;
  /** The theme actually in effect once 'system' is resolved. */
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredMode(): ThemeMode {
  const stored = storage.getString(StorageKey.themeMode);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    storage.setString(StorageKey.themeMode, next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
    return {
      theme: isDark ? darkTheme : lightTheme,
      mode,
      isDark,
      setMode,
    };
  }, [mode, systemScheme, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Returns the active theme tokens. The most-used hook in the app. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx.theme;
}

/** Returns the theme-mode controls, for the Settings screen's theme picker. */
export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeProvider');
  const { mode, isDark, setMode } = ctx;
  return { mode, isDark, setMode };
}
