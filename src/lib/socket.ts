import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/api/client';
import { API_BASE_URL } from '@/constants/config';

/** The gateway is mounted on the server root, not under the /api prefix. */
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export const RealtimeEvents = {
  orderCreated: 'order:created',
  orderItemsAdded: 'order:items_added',
  orderUpdated: 'order:updated',
  tableUpdated: 'table:updated',
  draftUpdated: 'draft:updated',
  /** Cashier drawers opening, closing, and being handed to the owner. */
  shiftOpened: 'shift:opened',
  shiftClosed: 'shift:closed',
  shiftCollected: 'shift:collected',
} as const;

let socket: Socket | null = null;

/**
 * One shared connection for the app.
 *
 * The server authenticates the handshake and derives room membership itself,
 * so there is nothing to subscribe to from here — the client only listens.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(`${SOCKET_URL}/realtime`, {
    transports: ['websocket'], // RN has no long-polling fallback worth using
    auth: { token: apiClient.getToken() },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Access tokens last 30 minutes, so a reconnect must present the CURRENT
  // one. Without this a device left on overnight silently stops receiving
  // orders — the worst failure mode for a kitchen.
  socket.io.on('reconnect_attempt', () => {
    if (socket) socket.auth = { token: apiClient.getToken() };
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
