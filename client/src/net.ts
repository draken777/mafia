import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/events';
import type { Result } from '../../shared/types';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Same origin by default (Vite proxies /socket.io in dev). Override with VITE_SERVER_URL. */
const SERVER_URL: string | undefined = import.meta.env.VITE_SERVER_URL || undefined;

export const socket: AppSocket = SERVER_URL ? io(SERVER_URL) : io();

const ACK_TIMEOUT_MS = 8_000;

/** Emit with an ack, resolving to a Result even on timeout. */
export function request<T>(emit: (ack: (r: Result<T>) => void) => void): Promise<Result<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'noResponse' }), ACK_TIMEOUT_MS);
    emit((r) => {
      clearTimeout(timer);
      resolve(r);
    });
  });
}
