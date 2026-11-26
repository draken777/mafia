// Socket event names and payloads. Client and server both import from here so they cannot drift.
import type { CloseReason } from './errors';
import type { PublicRoomState, Result, RolePatch, SessionInfo, Settings, TeamTag } from './types';

export const EV = {
  // client -> server
  createRoom: 'room:create',
  joinRoom: 'room:join',
  resume: 'session:resume',
  leave: 'room:leave',
  kick: 'room:kick',
  roleUpdate: 'roles:update',
  roleAdd: 'roles:add',
  roleDelete: 'roles:delete',
  rolePreset: 'roles:preset',
  settingsUpdate: 'settings:update',
  gameStart: 'game:start',
  gameReshuffle: 'game:reshuffle',
  gameEnd: 'game:end',
  // server -> client
  state: 'room:state',
  kicked: 'room:kicked',
  closed: 'room:closed',
} as const;

export type Ack<T> = (result: Result<T>) => void;

export interface CreateRoomPayload { name: string }
export interface JoinRoomPayload { code: string; name: string }
export interface ResumePayload { code: string; token: string }
export interface KickPayload { playerId: string }
export interface ClosedPayload { reason: CloseReason }
export interface RoleUpdatePayload { id: string; patch: RolePatch }
export interface RoleAddPayload { name: string; description: string; team: TeamTag }
export interface RoleDeletePayload { id: string }
export type SettingsPayload = Partial<Settings>;

export interface ClientToServerEvents {
  [EV.createRoom]: (p: CreateRoomPayload, ack: Ack<SessionInfo>) => void;
  [EV.joinRoom]: (p: JoinRoomPayload, ack: Ack<SessionInfo>) => void;
  [EV.resume]: (p: ResumePayload, ack: Ack<SessionInfo>) => void;
  [EV.leave]: (ack: Ack<null>) => void;
  [EV.kick]: (p: KickPayload, ack: Ack<null>) => void;
  [EV.roleUpdate]: (p: RoleUpdatePayload, ack: Ack<null>) => void;
  [EV.roleAdd]: (p: RoleAddPayload, ack: Ack<null>) => void;
  [EV.roleDelete]: (p: RoleDeletePayload, ack: Ack<null>) => void;
  [EV.rolePreset]: (ack: Ack<null>) => void;
  [EV.settingsUpdate]: (p: SettingsPayload, ack: Ack<null>) => void;
  [EV.gameStart]: (ack: Ack<null>) => void;
  [EV.gameReshuffle]: (ack: Ack<null>) => void;
  [EV.gameEnd]: (ack: Ack<null>) => void;
}

export interface ServerToClientEvents {
  [EV.state]: (s: PublicRoomState) => void;
  [EV.kicked]: () => void;
  [EV.closed]: (p: ClosedPayload) => void;
}
