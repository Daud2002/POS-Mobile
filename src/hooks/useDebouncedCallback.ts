import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounces a value. Used for search fields so list filtering doesn't run on
 * every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Debounces a callback, keyed by an id so concurrent targets don't cancel each
 * other.
 *
 * This is what stops the Inventory screen from firing a PATCH on every tap of
 * the stock stepper — the web version writes on every keystroke and then
 * reloads the entire product list each time.
 */
export function useDebouncedAction<T>(
  action: (id: string, value: T) => void,
  delayMs = 600,
) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  return useCallback(
    (id: string, value: T) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);

      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          actionRef.current(id, value);
        }, delayMs),
      );
    },
    [delayMs],
  );
}
