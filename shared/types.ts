import type { ErrorCode, MessageParams } from './errors';

// Domain types shared by client and server.
// Nothing in here may ever carry a role-to-player mapping (see CLAUDE.md rule 1).

export type TeamTag = 'mafia' | 'town' | 'neutral';

export interface Role {
  id: string;
  name: string;
  description: string;
  team: TeamTag;
  enabled: boolean;
  count: number;
  /** Shipped with the app (may be edited, not deleted). */
  isDefault: boolean;
  /** Mafia and Villager: cannot be disabled or deleted. */
  required: boolean;
}

export type RoomPhase = 'lobby' | 'game';

/** A player as every client in the room sees them. Never includes a role or token. */
export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  /** Holds a role in the current round. Not secret: says nothing about which role. */
  inRound: boolean;
}

/** Room settings. Roles in play are always shown to everyone (names only), so that is not a setting. */
export interface Settings {
  /** Default false: the host moderates and gets no role. */
  hostPlays: boolean;
  /** Seconds before a revealed role card hides itself. */
  revealSeconds: number;
  /** When the host moderates (hostPlays false), let the host see every assignment. Default false. */
  moderatorSeesRoles: boolean;
}

/** One assignment, only ever sent to a moderating host who enabled moderatorSeesRoles. */
export interface Assignment {
  playerId: string;
  name: string;
  role: RoleInfo;
}

/** The viewer's own place in the current round. Present only in that viewer's snapshot. */
export interface YourView {
  status: 'playing' | 'moderating' | 'waiting';
  /** The viewer's own role, or null if moderating/waiting. */
  role: RoleInfo | null;
  /** Full list, only for a moderating host with moderatorSeesRoles on; null otherwise. */
  everyone: Assignment[] | null;
}

/** Role as shown to every player in "Roles in play": no count, no owner. */
export interface RoleInfo {
  id: string;
  name: string;
  description: string;
  team: TeamTag;
}

/** Fields the host may change on a role. */
export interface RolePatch {
  name?: string;
  description?: string;
  team?: TeamTag;
  enabled?: boolean;
  count?: number;
}

/**
 * Room snapshot, built separately for each viewer. Everything here is visible to that viewer only;
 * `you`, `roles` and `rolesCustomized` differ per viewer, and no snapshot holds other players' roles
 * (except the opt-in moderator list in `you.everyone`).
 */
export interface PublicRoomState {
  code: string;
  phase: RoomPhase;
  hostId: string;
  players: PublicPlayer[];
  /** Epoch ms when the disconnected host loses the seat, or null if the host is connected. */
  hostGraceUntil: number | null;
  settings: Settings;
  /** Players who will receive a role (excludes a moderating host). */
  playersInGame: number;
  /** Role names in play, no counts or owners. Sent to everyone. */
  rolesInPlay: RoleInfo[];
  /** Full role config with counts. Only present in the host's copy; null for everyone else. */
  roles: Role[] | null;
  /** False while roles still follow the automatic preset for the player count. Host only. */
  rolesCustomized: boolean | null;
  /** Increments with every deal (start or reshuffle); 0 before the first game. */
  round: number;
  /** The viewer's own role info while a game is running; null in the lobby. */
  you: YourView | null;
}

/** What a client stores to rejoin after refresh. */
export interface SessionInfo {
  code: string;
  playerId: string;
  token: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; params?: MessageParams };
