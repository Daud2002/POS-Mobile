import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useApiBase } from '@/lib/apiBase';

import {
  ensureInitialConnection,
  evaluateConnection,
  refreshLocalStatus,
  useConnectionStore,
} from './connectionStore';

/** While unreachable: often enough to notice the PC coming back, rare enough not to drain a battery. */
const UNREACHABLE_RETRY_MS = 30_000;
/** On a store server: keeps "synced N min ago / N waiting" honest. */
const STATUS_POLL_MS = 15_000;

/** What screens read: where the app is talking to, and how that server is doing. */
export function useConnection() {
  const baseUrl = useApiBase((state) => state.baseUrl);
  const state = useConnectionStore(
    useShallow((s) => ({
      mode: s.mode,
      registered: s.registered,
      storeHealth: s.storeHealth,
      localStatus: s.localStatus,
      lastChecked: s.lastChecked,
    })),
  );
  return { ...state, baseUrl, recheck: evaluateConnection };
}

/**
 * Keeps the connection decision current. Mount once, high in the tree
 * (ConnectionProvider):
 *  - at start-up and every time the app returns to the foreground, re-probe —
 *    that is when a phone has most likely walked into or out of the shop;
 *  - every 30s while the store server can't be reached;
 *  - every 15s on a store server, poll its sync status for the banner.
 */
export function useConnectionLifecycle(): void {
  const mode = useConnectionStore((s) => s.mode);

  useEffect(() => {
    void ensureInitialConnection();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void evaluateConnection();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (mode === 'unreachable') {
      const id = setInterval(() => void evaluateConnection(), UNREACHABLE_RETRY_MS);
      return () => clearInterval(id);
    }
    if (mode === 'store') {
      void refreshLocalStatus();
      const id = setInterval(() => void refreshLocalStatus(), STATUS_POLL_MS);
      return () => clearInterval(id);
    }
    return undefined;
  }, [mode]);
}
