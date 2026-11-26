// Host intents for roles, settings and the game. The server validates everything; errors are shown inline.
import { EV, type RoleAddPayload, type SettingsPayload } from '../../shared/events';
import type { Result, RolePatch } from '../../shared/types';
import { request, socket } from './net';
import { refresh, ui } from './ui';

async function run(emit: (ack: (r: Result<null>) => void) => void): Promise<boolean> {
  const res = await request<null>(emit);
  ui.lobbyError = res.ok ? null : { code: res.error, params: res.params };
  if (!res.ok) refresh();
  return res.ok;
}

export const updateRole = (id: string, patch: RolePatch) =>
  run((ack) => socket.emit(EV.roleUpdate, { id, patch }, ack));

export const addRole = (p: RoleAddPayload) => run((ack) => socket.emit(EV.roleAdd, p, ack));

export const deleteRole = (id: string) => run((ack) => socket.emit(EV.roleDelete, { id }, ack));

export const usePreset = () => run((ack) => socket.emit(EV.rolePreset, ack));

export const updateSettings = (p: SettingsPayload) => run((ack) => socket.emit(EV.settingsUpdate, p, ack));

export const startGame = () => run((ack) => socket.emit(EV.gameStart, ack));

export const reshuffle = () => run((ack) => socket.emit(EV.gameReshuffle, ack));

export const endGame = () => run((ack) => socket.emit(EV.gameEnd, ack));

export const kick = (playerId: string) => run((ack) => socket.emit(EV.kick, { playerId }, ack));
