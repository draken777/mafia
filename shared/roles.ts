// Default role set, presets scaled to player count, and the role summary/validation
// used by the host's live view and (in Phase 3) by the server before starting.
import { MIN_PLAYERS } from './limits';
import type { Problem, WarningCode } from './errors';
import type { Role, RoleInfo, Settings, TeamTag } from './types';

export const MAFIA_ID = 'mafia';
export const VILLAGER_ID = 'villager';

export const DEFAULT_SETTINGS: Settings = { hostPlays: false, revealSeconds: 5, moderatorSeesRoles: false };

export const TEAMS: readonly TeamTag[] = ['mafia', 'town', 'neutral'];

type RoleSeed = Pick<Role, 'id' | 'name' | 'team' | 'required' | 'description'>;

const SEEDS: RoleSeed[] = [
  { id: MAFIA_ID, name: 'Mafia', team: 'mafia', required: true,
    description: 'Knows the other Mafia. Eliminate the town without getting caught.' },
  { id: VILLAGER_ID, name: 'Villager', team: 'town', required: true,
    description: 'No special power. Find the Mafia and vote them out.' },
  { id: 'sheriff', name: 'Sheriff', team: 'town', required: false,
    description: 'Each night, check one player to learn if they are good or bad (not their exact role). If the Police dies, you can also shoot.' },
  { id: 'doctor', name: 'Doctor', team: 'town', required: false,
    description: 'Each night, choose one player to protect from elimination.' },
  { id: 'maniac', name: 'Maniac', team: 'neutral', required: false,
    description: 'Plays alone. Eliminate everyone else to win.' },
  { id: 'kamikaze', name: 'Kamikaze', team: 'town', required: false,
    description: 'If eliminated, takes one player down with them.' },
  { id: 'police', name: 'Police', team: 'town', required: false,
    description: 'Each round, you may shoot one player. If the Sheriff dies, you can also check if a player is good or bad.' },
];

export function defaultRoles(): Role[] {
  return SEEDS.map((s) => ({ ...s, isDefault: true, enabled: s.required, count: s.id === MAFIA_ID ? 1 : 0 }));
}

/** Player count at which each optional default role joins the preset. */
const PRESET_THRESHOLDS: Record<string, number> = {
  doctor: 6,
  sheriff: 7,
  police: 9,
  maniac: 11,
  kamikaze: 13,
};

/** About one Mafia per four players, at least one. 4→1, 6→2, 10→3, 16→4, 20→5, 30→8. */
export function presetMafiaCount(players: number): number {
  return Math.max(1, Math.round(players / 4));
}

/**
 * Apply the preset for `players` to an existing role list. Keeps the host's name/description
 * edits and custom roles' own settings; only enabled/count of default roles change.
 */
export function applyPreset(roles: Role[], players: number): Role[] {
  return roles.map((r) => {
    if (!r.isDefault) return r;
    if (r.id === MAFIA_ID) return { ...r, enabled: true, count: presetMafiaCount(players) };
    if (r.id === VILLAGER_ID) return { ...r, enabled: true, count: 0 };
    const threshold = PRESET_THRESHOLDS[r.id];
    const on = threshold !== undefined && players >= threshold;
    return { ...r, enabled: on, count: on ? 1 : 0 };
  });
}

export function playersInGame(playerCount: number, settings: Settings): number {
  return Math.max(0, playerCount - (settings.hostPlays ? 0 : 1));
}

/** Enabled non-Villager roles with at least one copy. */
export function specialRoles(roles: Role[]): Role[] {
  return roles.filter((r) => r.id !== VILLAGER_ID && r.enabled && r.count > 0);
}

export interface RoleSummary {
  players: number;
  special: number;
  villagers: number;
  mafia: number;
  /** Block starting the game. */
  errors: Problem[];
  /** Allowed, but probably not what the host wants. */
  warnings: Problem<WarningCode>[];
}

export function summarizeRoles(roles: Role[], players: number): RoleSummary {
  const special = specialRoles(roles).reduce((n, r) => n + r.count, 0);
  const mafia = specialRoles(roles)
    .filter((r) => r.team === 'mafia')
    .reduce((n, r) => n + r.count, 0);
  const villagers = Math.max(0, players - special);
  const errors: Problem[] = [];
  const warnings: Problem<WarningCode>[] = [];

  if (players < MIN_PLAYERS) errors.push({ code: 'notEnoughPlayers', params: { min: MIN_PLAYERS, n: players } });
  if (mafia < 1) errors.push({ code: 'noMafia' });
  if (special > players) errors.push({ code: 'tooManyRoles', params: { roles: special, n: players } });
  if (players >= MIN_PLAYERS && mafia >= 1 && mafia * 2 >= players) warnings.push({ code: 'mafiaHeavy' });
  return { players, special, villagers, mafia, errors, warnings };
}

export function toRoleInfo({ id, name, description, team }: Role): RoleInfo {
  return { id, name, description, team };
}

/** Expand the role setup into one slot per player: special roles, then Villagers for the rest. */
export function buildSlots(roles: Role[], players: number): Role[] {
  const slots = specialRoles(roles).flatMap((r) => Array.from({ length: r.count }, () => r));
  const villager = roles.find((r) => r.id === VILLAGER_ID);
  if (!villager) throw new Error('Villager role missing');
  while (slots.length < players) slots.push(villager);
  return slots;
}

/** What every player sees as "Roles in play": names only, no counts. */
export function rolesInPlay(roles: Role[], players: number): RoleInfo[] {
  const { villagers } = summarizeRoles(roles, players);
  return roles
    .filter((r) => (r.id === VILLAGER_ID ? villagers > 0 : r.enabled && r.count > 0))
    .map(({ id, name, description, team }) => ({ id, name, description, team }));
}
