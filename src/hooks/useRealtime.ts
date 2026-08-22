import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

/** Poll interval used only while the socket is down. */
const FALLBACK_POLL_MS = 10_000;

export interface UseRealtimeOptions {
  events: string[];
  onChange: () => void;
  enabled?: boolean;
}

/**
 * Subscribes to server pushes, with a polling fallback whenever the socket is
 * down.
 *
 * The fallback is not optional: a device that quietly stops receiving orders
 * looks exactly like a quiet service. `connected` is returned so screens can
 * show an explicit banner rather than appearing healthy while going stale.
 */
export function useRealtime({ events, onChange, enabled = true }: UseRealtimeOptions) {
  const [connected, setConnected] = useState(false);

  // Held in a ref so a re-render does not tear down the listeners.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const eventKey = events.join(',');

  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    const handler = () => onChangeRef.current();
    const list = eventKey.split(',').filter(Boolean);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);
    for (const event of list) socket.on(event, handler);

    setConnected(socket.connected);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
      for (const event of list) socket.off(event, handler);
    };
  }, [eventKey, enabled]);

  useEffect(() => {
    if (!enabled || connected) return;
    const id = setInterval(() => onChangeRef.current(), FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [connected, enabled]);

  return { connected };
}
