import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server, type Socket } from 'socket.io';
import { EV, type ClientToServerEvents, type ServerToClientEvents } from '../../shared/events';
import type { Result } from '../../shared/types';
import { LIMITS, RateLimiter } from './rateLimit';
import { RoomManager, type RoomEvent } from './rooms';
import { staticHandler } from './static';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const PORT = Number(process.env.PORT ?? 3001);
const TICK_MS = 5_000;
const CLIENT_DIR = process.env.CLIENT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../client');
/** Only needed if the client is hosted on a different origin than this server. Comma-separated. */
const CORS_ORIGIN = process.env.CORS_ORIGIN;
/** Set to 1 behind a reverse proxy (Render, Railway, Fly) so the client IP comes from X-Forwarded-For. */
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';

// ---------- HTTP: health check + built client (when present) ----------

const serveClient = existsSync(join(CLIENT_DIR, 'index.html')) ? staticHandler(CLIENT_DIR) : null;

const httpServer = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('ok');
    return;
  }
  if (req.url?.startsWith('/socket.io')) return; // handled by Socket.IO
  if (serveClient) return serveClient(req, res);
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Client not built. Run `npm run build`, or use `npm run dev`.');
});

const io: IoServer = new Server(httpServer, {
  cors: CORS_ORIGIN ? { origin: CORS_ORIGIN.split(',').map((s) => s.trim()) } : undefined,
  maxHttpBufferSize: 16_000,
  pingInterval: 20_000,
  pingTimeout: 20_000,
});
const rooms = new RoomManager();

// ---------- abuse limits ----------

const createLimit = new RateLimiter(LIMITS.createPerIp.limit, LIMITS.createPerIp.windowMs);
const joinLimit = new RateLimiter(LIMITS.joinPerIp.limit, LIMITS.joinPerIp.windowMs);
const resumeLimit = new RateLimiter(LIMITS.resumePerIp.limit, LIMITS.resumePerIp.windowMs);
const eventLimit = new RateLimiter(LIMITS.eventsPerSocket.limit, LIMITS.eventsPerSocket.windowMs);
const connectionsByIp = new Map<string, number>();

function clientIp(req: IncomingMessage, fallback: string): string {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return fallback || 'unknown';
}

const RATE_LIMITED = { ok: false, error: 'rateLimited' } as const;

// Cap concurrent connections per IP (generous: a whole party can share one Wi-Fi IP).
io.use((socket, next) => {
  const ip = clientIp(socket.request, socket.handshake.address);
  const open = connectionsByIp.get(ip) ?? 0;
  if (open >= LIMITS.connectionsPerIp) return next(new Error('rateLimited'));
  connectionsByIp.set(ip, open + 1);
  socket.data.ip = ip;
  socket.on('disconnect', () => {
    const n = (connectionsByIp.get(ip) ?? 1) - 1;
    if (n <= 0) connectionsByIp.delete(ip);
    else connectionsByIp.set(ip, n);
  });
  next();
});

// ---------- helpers ----------

/** Wrap an ack so a missing/invalid callback from a misbehaving client can't throw. */
function safeAck<T>(ack: unknown): (r: Result<T>) => void {
  return typeof ack === 'function' ? (ack as (r: Result<T>) => void) : () => {};
}

/** Each member gets their own snapshot: only the host's includes role counts. */
function broadcastState(code: string): void {
  for (const socketId of rooms.socketsIn(code)) {
    const viewer = rooms.lookup(socketId);
    const state = rooms.publicState(code, viewer?.playerId);
    if (state) io.sockets.sockets.get(socketId)?.emit(EV.state, state);
  }
}

/** Shared shape for host edit handlers: run, ack, then broadcast. */
function hostEdit(ack: unknown, run: () => Result<RoomEvent[]>): void {
  const reply = safeAck<null>(ack);
  const res = run();
  if (!res.ok) return reply(res);
  reply({ ok: true, data: null });
  applyEvents(res.data);
}

function applyEvents(events: RoomEvent[]): void {
  for (const ev of events) {
    if (ev.type === 'state') {
      broadcastState(ev.code);
    } else {
      for (const id of ev.socketIds) {
        const s = io.sockets.sockets.get(id);
        s?.emit(EV.closed, { reason: ev.reason });
        s?.leave(ev.code);
      }
    }
  }
}

/** Put the socket into exactly one Socket.IO room: the game room it belongs to. */
function enterRoom(socket: IoSocket, code: string): void {
  for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
  socket.join(code);
}

function leaveAllRooms(socket: IoSocket): void {
  for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
}

// ---------- events ----------

io.on('connection', (socket) => {
  const ip: string = socket.data.ip;

  // Flood guard for every event from this socket. Over the limit: reply rateLimited and drop it.
  socket.use((packet, next) => {
    if (eventLimit.take(socket.id)) return next();
    const ack = packet[packet.length - 1];
    if (typeof ack === 'function') ack(RATE_LIMITED);
  });

  socket.on(EV.createRoom, (p, ack) => {
    const reply = safeAck(ack);
    if (!createLimit.take(ip)) return reply(RATE_LIMITED);
    const res = rooms.createRoom(p?.name, socket.id);
    // Ack first so the client holds its session before the first state broadcast arrives.
    if (res.ok) enterRoom(socket, res.data.code);
    reply(res);
    if (res.ok) broadcastState(res.data.code);
  });

  socket.on(EV.joinRoom, (p, ack) => {
    const reply = safeAck(ack);
    if (!joinLimit.take(ip)) return reply(RATE_LIMITED);
    const res = rooms.joinRoom(p?.code, p?.name, socket.id);
    if (res.ok) enterRoom(socket, res.data.code);
    reply(res);
    if (res.ok) broadcastState(res.data.code);
  });

  socket.on(EV.resume, (p, ack) => {
    const reply = safeAck(ack);
    if (!resumeLimit.take(ip)) return reply(RATE_LIMITED);
    const res = rooms.resume(p?.code, p?.token, socket.id);
    if (!res.ok) return reply(res);
    const { replacedSocketId, ...session } = res.data;
    if (replacedSocketId) {
      const old = io.sockets.sockets.get(replacedSocketId);
      old?.emit(EV.closed, { reason: 'otherTab' });
      old?.leave(session.code);
    }
    enterRoom(socket, session.code);
    reply({ ok: true, data: session });
    broadcastState(session.code);
  });

  socket.on(EV.leave, (ack) => {
    const reply = safeAck<null>(ack);
    const events = rooms.leave(socket.id);
    leaveAllRooms(socket);
    applyEvents(events);
    reply({ ok: true, data: null });
  });

  socket.on(EV.kick, (p, ack) => {
    const reply = safeAck<null>(ack);
    const res = rooms.kick(socket.id, String(p?.playerId ?? ''));
    if (!res.ok) return reply(res);
    const { kickedSocketId, events } = res.data;
    if (kickedSocketId) {
      const kicked = io.sockets.sockets.get(kickedSocketId);
      kicked?.emit(EV.kicked);
      if (kicked) leaveAllRooms(kicked);
    }
    applyEvents(events);
    reply({ ok: true, data: null });
  });

  socket.on(EV.roleUpdate, (p, ack) => hostEdit(ack, () => rooms.updateRole(socket.id, p?.id, p?.patch)));
  socket.on(EV.roleAdd, (p, ack) => hostEdit(ack, () => rooms.addRole(socket.id, p ?? {})));
  socket.on(EV.roleDelete, (p, ack) => hostEdit(ack, () => rooms.deleteRole(socket.id, p?.id)));
  socket.on(EV.rolePreset, (ack) => hostEdit(ack, () => rooms.usePreset(socket.id)));
  socket.on(EV.settingsUpdate, (p, ack) => hostEdit(ack, () => rooms.updateSettings(socket.id, p)));

  socket.on(EV.gameStart, (ack) => hostEdit(ack, () => rooms.startGame(socket.id)));
  socket.on(EV.gameReshuffle, (ack) => hostEdit(ack, () => rooms.reshuffle(socket.id)));
  socket.on(EV.gameEnd, (ack) => hostEdit(ack, () => rooms.endGame(socket.id)));

  socket.on('disconnect', () => {
    eventLimit.forget(socket.id);
    applyEvents(rooms.disconnect(socket.id));
  });
});

setInterval(() => {
  applyEvents(rooms.tick());
  for (const l of [createLimit, joinLimit, resumeLimit, eventLimit]) l.sweep();
}, TICK_MS).unref();

httpServer.listen(PORT, () => {
  console.log(`[mafia] listening on :${PORT}${serveClient ? ' (serving client)' : ' (API only; client via Vite)'}`);
});

// Rooms live in memory, so a restart ends all games. Close cleanly so clients reconnect promptly.
function shutdown(): void {
  console.log('[mafia] shutting down');
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
