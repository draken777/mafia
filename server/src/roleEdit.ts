// Pure role-list edits with validation. Every host edit goes through these on the server.
import { randomUUID } from 'node:crypto';
import { MAX_PLAYERS, MAX_ROLES, ROLE_DESC_MAX, ROLE_NAME_MAX, cleanText } from '../../shared/limits';
import { MAFIA_ID, TEAMS, VILLAGER_ID } from '../../shared/roles';
import type { ErrorCode, MessageParams } from '../../shared/errors';
import type { Result, Role, RolePatch, TeamTag } from '../../shared/types';

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = <T = never>(error: ErrorCode, params?: MessageParams): Result<T> =>
  params ? { ok: false, error, params } : { ok: false, error };

const isTeam = (t: unknown): t is TeamTag => typeof t === 'string' && (TEAMS as readonly string[]).includes(t);

function nameClash(roles: Role[], name: string, exceptId?: string): boolean {
  const key = name.toLocaleLowerCase();
  return roles.some((r) => r.id !== exceptId && r.name.toLocaleLowerCase() === key);
}

function cleanCount(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return Math.min(MAX_PLAYERS, Math.max(0, Math.trunc(raw)));
}

export function updateRole(roles: Role[], id: unknown, rawPatch: unknown): Result<Role[]> {
  const role = roles.find((r) => r.id === id);
  if (!role) return fail('roleNotFound');
  if (typeof rawPatch !== 'object' || rawPatch === null) return fail('nothingToChange');
  const patch = rawPatch as RolePatch;
  const next: Role = { ...role };

  if (patch.name !== undefined) {
    const name = cleanText(patch.name, ROLE_NAME_MAX);
    if (!name) return fail('roleNameEmpty');
    if (nameClash(roles, name, role.id)) return fail('roleNameTaken');
    next.name = name;
  }
  if (patch.description !== undefined) {
    next.description = cleanText(patch.description, ROLE_DESC_MAX);
  }
  if (patch.team !== undefined) {
    if (!isTeam(patch.team)) return fail('unknownTeam');
    if (role.required && patch.team !== role.team) return fail('roleTeamLocked', { role: role.id });
    next.team = patch.team;
  }
  if (patch.enabled !== undefined) {
    if (typeof patch.enabled !== 'boolean') return fail('invalidValue');
    if (role.required && !patch.enabled) return fail('roleRequired', { role: role.id });
    next.enabled = patch.enabled;
    if (next.enabled && next.count === 0 && role.id !== VILLAGER_ID) next.count = 1;
  }
  if (patch.count !== undefined) {
    if (role.id === VILLAGER_ID) return fail('villagerAuto');
    const count = cleanCount(patch.count);
    if (count === null) return fail('invalidValue');
    if (role.id === MAFIA_ID && count < 1) return fail('mafiaMin');
    next.count = count;
    // For optional roles, 0 means off and >0 means on.
    if (!role.required) next.enabled = count > 0;
  }
  return ok(roles.map((r) => (r.id === role.id ? next : r)));
}

export function addRole(roles: Role[], raw: { name?: unknown; description?: unknown; team?: unknown }): Result<Role[]> {
  if (roles.length >= MAX_ROLES) return fail('tooManyRoleDefs', { max: MAX_ROLES });
  const name = cleanText(raw?.name, ROLE_NAME_MAX);
  if (!name) return fail('roleNameEmpty');
  if (nameClash(roles, name)) return fail('roleNameTaken');
  const team = raw?.team === undefined ? 'town' : raw.team;
  if (!isTeam(team)) return fail('unknownTeam');
  const role: Role = {
    id: `c-${randomUUID()}`,
    name,
    description: cleanText(raw?.description, ROLE_DESC_MAX),
    team,
    enabled: true,
    count: 1,
    isDefault: false,
    required: false,
  };
  return ok([...roles, role]);
}

export function deleteRole(roles: Role[], id: unknown): Result<Role[]> {
  const role = roles.find((r) => r.id === id);
  if (!role) return fail('roleNotFound');
  if (role.isDefault) return fail('cannotDeleteDefault');
  return ok(roles.filter((r) => r.id !== role.id));
}
