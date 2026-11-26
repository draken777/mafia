// Room lifecycle, independent of sockets so it can be unit-tested.
// The caller passes in the acting player's id as resolved from its own socket map,
// never a client-supplied identity (CLAUDE.md rule 2).
import { randomBytes, randomUUID } from 'node:crypto';
import { MAX_PLAYERS, MAX_ROOMS, NAME_MAX, cleanText, isValidCode, normalizeCode } from '../../shared/limits';
import {
  DEFAULT_SETTINGS, applyPreset, defaultRoles, playersInGame, rolesInPlay, toRoleInfo,
} from '../../shared/roles';
import { dealRoles } from './deal';
import { REVEAL_SECONDS_MAX, REVEAL_SECONDS_MIN } from '../../shared/limits';
import type {
  Assignment, PublicRoomState, Result, Role, RoomPhase, SessionInfo, Settings, YourView,
} from '../../shared/types';
import type { CloseReason, ErrorCode, MessageParams } from '../../shared/errors';
import { generateCode, type RandomInt } from './codes';
import { addRole, deleteRole, updateRole } from './roleEdit';

export const HOST_GRACE_MS = 30_000;
/** No join/leave/kick/rejoin for this long closes the room, even with tabs left open. */
export const IDLE_ROOM_MS = 4 * 60 * 60_000;
/** Everybody disconnected for this long closes the room. */
export const EMPTY_ROOM_MS = 10 * 60_000;

interface PlayerRecord {
  id: string;
  name: string;
  token: string;
  socketId: string | null;
  joinedAt: number;
  disconnectedAt: number | null;
}

interface RoomRecord {
  code: string;
  phase: RoomPhase;
  hostId: string;
  players: Map<string, PlayerRecord>;
  lastActivity: number;
  hostGraceUntil: number | null;
  roles: Role[];
  settings: Settings;
  /** Once the host edits roles, stop re-applying the preset when players come and go. */
  rolesCustomized: boolean;
  round: number;
  /** playerId → roleId for the current round. Never sent to clients as a whole. */
  assignments: Map<string, string>;
  /** Role definitions as they were when the round was dealt. */
  dealtRoles: Role[];
}

/** Something the socket layer has to tell clients about. */
export type RoomEvent =
  | { type: 'state'; code: string }
  | { type: 'closed'; code: string; socketIds: string[]; reason: CloseReason };

export interface RoomManagerOptions {
  now?: () => number;
  rand?: RandomInt;
}

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = <T = never>(error: ErrorCode, params?: MessageParams): Result<T> =>
  params ? { ok: false, error, params } : { ok: false, error };

export class RoomManager {
  private rooms = new Map<string, RoomRecord>();
  private bySocket = new Map<string, { code: string; playerId: string }>();
  private now: () => number;
  private rand: RandomInt | undefined;

  constructor(opts: RoomManagerOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.rand = opts.rand;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  /** Which room/player a socket currently represents. */
  lookup(socketId: string): { code: string; playerId: string } | undefined {
    return this.bySocket.get(socketId);
  }

  createRoom(rawName: string, socketId: string): Result<SessionInfo> {
    const name = cleanText(rawName, NAME_MAX);
    if (!name) return fail('nameEmpty');
    if (this.rooms.size >= MAX_ROOMS) return fail('serverBusy');
    this.detachSocket(socketId);

    const code = generateCode((c) => this.rooms.has(c), this.rand);
    const host = this.newPlayer(name, socketId);
    this.rooms.set(code, {
      code,
      phase: 'lobby',
      hostId: host.id,
      players: new Map([[host.id, host]]),
      lastActivity: this.now(),
      hostGraceUntil: null,
      roles: [],
      settings: { ...DEFAULT_SETTINGS },
      rolesCustomized: false,
      round: 0,
      assignments: new Map(),
      dealtRoles: [],
    });
    this.refreshPreset(this.rooms.get(code)!);
    this.bySocket.set(socketId, { code, playerId: host.id });
    return ok({ code, playerId: host.id, token: host.token });
  }

  joinRoom(rawCode: string, rawName: string, socketId: string): Result<SessionInfo> {
    const code = normalizeCode(String(rawCode ?? ''));
    if (!isValidCode(code)) return fail('codeInvalid');
    const room = this.rooms.get(code);
    if (!room) return fail('roomNotFound');
    const name = cleanText(rawName, NAME_MAX);
    if (!name) return fail('nameEmpty');
    if (this.nameTaken(room, name)) return fail('nameTaken');
    if (room.players.size >= MAX_PLAYERS) return fail('roomFull');

    this.detachSocket(socketId);
    const player = this.newPlayer(name, socketId);
    room.players.set(player.id, player);
    room.lastActivity = this.now();
    this.refreshPreset(room);
    this.bySocket.set(socketId, { code, playerId: player.id });
    return ok({ code, playerId: player.id, token: player.token });
  }

  /**
   * Reattach a socket to an existing seat using its session token.
   * Returns the socket id the seat was previously bound to (another tab), if any.
   */
  resume(rawCode: string, token: string, socketId: string): Result<SessionInfo & { replacedSocketId: string | null }> {
    const code = normalizeCode(String(rawCode ?? ''));
    const room = this.rooms.get(code);
    if (!room) return fail('roomGone');
    const player = [...room.players.values()].find((p) => p.token === token && typeof token === 'string');
    if (!player) return fail('seatGone');

    const replacedSocketId = player.socketId && player.socketId !== socketId ? player.socketId : null;
    if (replacedSocketId) this.bySocket.delete(replacedSocketId);
    this.detachSocket(socketId);

    player.socketId = socketId;
    player.disconnectedAt = null;
    if (room.hostId === player.id) room.hostGraceUntil = null;
    room.lastActivity = this.now();
    this.bySocket.set(socketId, { code, playerId: player.id });
    return ok({ code, playerId: player.id, token: player.token, replacedSocketId });
  }

  /** Player leaves voluntarily. */
  leave(socketId: string): RoomEvent[] {
    const ref = this.bySocket.get(socketId);
    if (!ref) return [];
    this.bySocket.delete(socketId);
    return this.removePlayer(ref.code, ref.playerId);
  }

  /** Host removes another player. Returns the kicked player's socket id so it can be notified. */
  kick(actorSocketId: string, targetId: string): Result<{ kickedSocketId: string | null; events: RoomEvent[] }> {
    const ref = this.bySocket.get(actorSocketId);
    if (!ref) return fail('notInRoom');
    const room = this.rooms.get(ref.code);
    if (!room) return fail('roomGone');
    if (room.hostId !== ref.playerId) return fail('notHost');
    if (targetId === ref.playerId) return fail('kickSelf');
    const target = room.players.get(targetId);
    if (!target) return fail('playerNotFound');

    const kickedSocketId = target.socketId;
    if (kickedSocketId) this.bySocket.delete(kickedSocketId);
    const events = this.removePlayer(room.code, targetId);
    return ok({ kickedSocketId, events });
  }

  // ---------- host-only role and settings edits ----------

  updateRole(actorSocketId: string, id: unknown, patch: unknown): Result<RoomEvent[]> {
    return this.editRoles(actorSocketId, (roles) => updateRole(roles, id, patch));
  }

  addRole(actorSocketId: string, raw: { name?: unknown; description?: unknown; team?: unknown }): Result<RoomEvent[]> {
    return this.editRoles(actorSocketId, (roles) => addRole(roles, raw));
  }

  deleteRole(actorSocketId: string, id: unknown): Result<RoomEvent[]> {
    return this.editRoles(actorSocketId, (roles) => deleteRole(roles, id));
  }

  /** Go back to the automatic preset for the current player count, and keep following it. */
  usePreset(actorSocketId: string): Result<RoomEvent[]> {
    const res = this.hostLobbyRoom(actorSocketId);
    if (!res.ok) return res;
    const room = res.data;
    room.rolesCustomized = false;
    this.refreshPreset(room);
    room.lastActivity = this.now();
    return ok([{ type: 'state', code: room.code }]);
  }

  updateSettings(actorSocketId: string, raw: unknown): Result<RoomEvent[]> {
    const res = this.hostLobbyRoom(actorSocketId);
    if (!res.ok) return res;
    const room = res.data;
    if (typeof raw !== 'object' || raw === null) return fail('nothingToChange');
    const patch = raw as Partial<Settings>;
    const next = { ...room.settings };
    if (patch.hostPlays !== undefined) {
      if (typeof patch.hostPlays !== 'boolean') return fail('invalidValue');
      next.hostPlays = patch.hostPlays;
    }
    if (patch.revealSeconds !== undefined) {
      const n = patch.revealSeconds;
      if (typeof n !== 'number' || !Number.isFinite(n)) return fail('invalidValue');
      next.revealSeconds = Math.min(REVEAL_SECONDS_MAX, Math.max(REVEAL_SECONDS_MIN, Math.round(n)));
    }
    if (patch.moderatorSeesRoles !== undefined) {
      if (typeof patch.moderatorSeesRoles !== 'boolean') return fail('invalidValue');
      next.moderatorSeesRoles = patch.moderatorSeesRoles;
    }
    room.settings = next;
    this.refreshPreset(room); // host playing or not changes the player count
    room.lastActivity = this.now();
    return ok([{ type: 'state', code: room.code }]);
  }

  // ---------- game flow (host only) ----------

  startGame(actorSocketId: string): Result<RoomEvent[]> {
    const res = this.hostLobbyRoom(actorSocketId);
    if (!res.ok) return res;
    return this.deal(res.data);
  }

  /** Deal again with the current setup, including anyone who joined mid-game. */
  reshuffle(actorSocketId: string): Result<RoomEvent[]> {
    const res = this.hostGameRoom(actorSocketId);
    if (!res.ok) return res;
    return this.deal(res.data);
  }

  endGame(actorSocketId: string): Result<RoomEvent[]> {
    const res = this.hostGameRoom(actorSocketId);
    if (!res.ok) return res;
    const room = res.data;
    room.phase = 'lobby';
    room.assignments = new Map();
    room.dealtRoles = [];
    this.refreshPreset(room);
    room.lastActivity = this.now();
    return ok([{ type: 'state', code: room.code }]);
  }

  /** Socket dropped without leaving. The seat is kept for rejoin. */
  disconnect(socketId: string): RoomEvent[] {
    const ref = this.bySocket.get(socketId);
    if (!ref) return [];
    this.bySocket.delete(socketId);
    const room = this.rooms.get(ref.code);
    const player = room?.players.get(ref.playerId);
    if (!room || !player || player.socketId !== socketId) return [];

    player.socketId = null;
    player.disconnectedAt = this.now();
    if (room.hostId === player.id) room.hostGraceUntil = this.now() + HOST_GRACE_MS;
    return [{ type: 'state', code: room.code }];
  }

  /** Periodic housekeeping: host grace expiry and idle-room cleanup. */
  tick(): RoomEvent[] {
    const now = this.now();
    const events: RoomEvent[] = [];
    for (const room of [...this.rooms.values()]) {
      const players = [...room.players.values()];
      const connected = players.filter((p) => p.socketId);

      if (now - room.lastActivity >= IDLE_ROOM_MS) {
        events.push(this.closeRoom(room, 'idle'));
        continue;
      }
      if (connected.length === 0) {
        const lastSeen = Math.max(...players.map((p) => p.disconnectedAt ?? now));
        if (now - lastSeen >= EMPTY_ROOM_MS) {
          events.push(this.closeRoom(room, 'empty'));
          continue;
        }
      }
      if (room.hostGraceUntil !== null && now >= room.hostGraceUntil) {
        const next = this.pickNextHost(room, room.hostId, true);
        if (next) {
          room.hostId = next.id;
          room.hostGraceUntil = null;
          events.push({ type: 'state', code: room.code });
        } else {
          events.push(this.closeRoom(room, 'hostGone'));
        }
      }
    }
    return events;
  }

  /**
   * Room snapshot for one viewer. Only the host's copy includes role counts;
   * nobody's copy ever includes who holds which role.
   */
  publicState(code: string, viewerId?: string): PublicRoomState | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    const isHost = viewerId !== undefined && viewerId === room.hostId;
    const inGame = room.phase === 'game' ? room.assignments.size : playersInGame(room.players.size, room.settings);
    const shownRoles = room.phase === 'game' ? room.dealtRoles : room.roles;
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      hostGraceUntil: room.hostGraceUntil,
      settings: { ...room.settings },
      playersInGame: inGame,
      rolesInPlay: rolesInPlay(shownRoles, inGame),
      round: room.round,
      you: this.yourView(room, viewerId),
      roles: isHost ? room.roles.map((r) => ({ ...r })) : null,
      rolesCustomized: isHost ? room.rolesCustomized : null,
      players: [...room.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          id: p.id, name: p.name, connected: p.socketId !== null,
          isHost: p.id === room.hostId, inRound: room.assignments.has(p.id),
        })),
    };
  }

  /** Socket ids currently attached to a room (for broadcasting state). */
  socketsIn(code: string): string[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return [...room.players.values()].flatMap((p) => (p.socketId ? [p.socketId] : []));
  }

  // ---------- internals ----------

  private joinCounter = 0;

  private newPlayer(name: string, socketId: string): PlayerRecord {
    // joinedAt gets a tiebreaker so ordering is stable even within the same millisecond.
    return {
      id: randomUUID(),
      name,
      token: randomBytes(24).toString('base64url'),
      socketId,
      joinedAt: this.now() + this.joinCounter++ / 1e6,
      disconnectedAt: null,
    };
  }

  /** Resolve the acting socket to a room where it is the host and the game has not started. */
  private hostLobbyRoom(socketId: string): Result<RoomRecord> {
    const ref = this.bySocket.get(socketId);
    if (!ref) return fail('notInRoom');
    const room = this.rooms.get(ref.code);
    if (!room) return fail('roomGone');
    if (room.hostId !== ref.playerId) return fail('notHost');
    if (room.phase !== 'lobby') return fail('gameRunning');
    return ok(room);
  }

  private editRoles(socketId: string, edit: (roles: Role[]) => Result<Role[]>): Result<RoomEvent[]> {
    const res = this.hostLobbyRoom(socketId);
    if (!res.ok) return res;
    const room = res.data;
    const next = edit(room.roles);
    if (!next.ok) return next;
    room.roles = next.data;
    room.rolesCustomized = true;
    room.lastActivity = this.now();
    return ok([{ type: 'state', code: room.code }]);
  }

  /** While roles follow the preset, rescale them to the current number of players in the game. */
  private refreshPreset(room: RoomRecord): void {
    if (room.rolesCustomized) return;
    const base = room.roles.length ? room.roles : defaultRoles();
    room.roles = applyPreset(base, playersInGame(room.players.size, room.settings));
  }

  private hostGameRoom(socketId: string): Result<RoomRecord> {
    const ref = this.bySocket.get(socketId);
    if (!ref) return fail('notInRoom');
    const room = this.rooms.get(ref.code);
    if (!room) return fail('roomGone');
    if (room.hostId !== ref.playerId) return fail('notHost');
    if (room.phase !== 'game') return fail('gameNotRunning');
    return ok(room);
  }

  private deal(room: RoomRecord): Result<RoomEvent[]> {
    const playerIds = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .filter((p) => room.settings.hostPlays || p.id !== room.hostId)
      .map((p) => p.id);
    const res = dealRoles(room.roles, playerIds, this.rand);
    if (!res.ok) return fail(res.problem.code, res.problem.params);
    room.assignments = res.assignments;
    room.dealtRoles = room.roles.map((r) => ({ ...r }));
    room.phase = 'game';
    room.round += 1;
    room.lastActivity = this.now();
    return ok([{ type: 'state', code: room.code }]);
  }

  /** The viewer's own slice of the round. Only a moderating host may get the full list, and only if enabled. */
  private yourView(room: RoomRecord, viewerId: string | undefined): YourView | null {
    if (room.phase !== 'game' || viewerId === undefined || !room.players.has(viewerId)) return null;
    const roleById = (id: string) => room.dealtRoles.find((r) => r.id === id);
    const mine = room.assignments.get(viewerId);
    if (mine !== undefined) {
      const role = roleById(mine);
      return { status: 'playing', role: role ? toRoleInfo(role) : null, everyone: null };
    }
    const moderating = viewerId === room.hostId && !room.settings.hostPlays;
    if (!moderating) return { status: 'waiting', role: null, everyone: null };
    let everyone: Assignment[] | null = null;
    if (room.settings.moderatorSeesRoles) {
      everyone = [...room.assignments].flatMap(([playerId, roleId]) => {
        const p = room.players.get(playerId);
        const role = roleById(roleId);
        return p && role ? [{ playerId, name: p.name, role: toRoleInfo(role) }] : [];
      });
    }
    return { status: 'moderating', role: null, everyone };
  }

  private nameTaken(room: RoomRecord, name: string): boolean {
    const key = name.toLocaleLowerCase();
    return [...room.players.values()].some((p) => p.name.toLocaleLowerCase() === key);
  }

  /** A socket can only hold one seat; drop any previous one (as a leave). */
  private detachSocket(socketId: string): void {
    if (this.bySocket.has(socketId)) this.leave(socketId);
  }

  private removePlayer(code: string, playerId: string): RoomEvent[] {
    const room = this.rooms.get(code);
    if (!room || !room.players.delete(playerId)) return [];
    room.assignments.delete(playerId);
    room.lastActivity = this.now();

    if (room.players.size === 0) return [this.closeRoom(room, 'empty')];
    this.refreshPreset(room);
    if (room.hostId === playerId) {
      const next = this.pickNextHost(room, playerId, false);
      if (!next) return [this.closeRoom(room, 'hostLeft')];
      room.hostId = next.id;
      room.hostGraceUntil = next.socketId ? null : this.now() + HOST_GRACE_MS;
    }
    return [{ type: 'state', code }];
  }

  /** Earliest-joined other player, preferring connected ones. */
  private pickNextHost(room: RoomRecord, excludeId: string, connectedOnly: boolean): PlayerRecord | undefined {
    const others = [...room.players.values()]
      .filter((p) => p.id !== excludeId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    return others.find((p) => p.socketId) ?? (connectedOnly ? undefined : others[0]);
  }

  private closeRoom(room: RoomRecord, reason: CloseReason): RoomEvent {
    const socketIds = this.socketsIn(room.code);
    for (const id of socketIds) this.bySocket.delete(id);
    this.rooms.delete(room.code);
    return { type: 'closed', code: room.code, socketIds, reason };
  }
}
