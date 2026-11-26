import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAFIA_ID, VILLAGER_ID, applyPreset, defaultRoles, presetMafiaCount, rolesInPlay, summarizeRoles,
} from '../../shared/roles';
import type { Role } from '../../shared/types';
import { addRole, deleteRole, updateRole } from './roleEdit';
import { RoomManager } from './rooms';

const unwrap = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const byId = (roles: Role[], id: string) => roles.find((r) => r.id === id)!;

describe('presets', () => {
  it('scales Mafia with player count', () => {
    expect([4, 5, 6, 8, 10, 12, 16, 20, 30].map(presetMafiaCount)).toEqual([1, 1, 2, 2, 3, 3, 4, 5, 8]);
  });

  it('adds optional roles as the table grows', () => {
    const on = (n: number) => applyPreset(defaultRoles(), n).filter((r) => r.enabled && r.count > 0).map((r) => r.id);
    expect(on(4)).toEqual([MAFIA_ID]);
    expect(on(6)).toEqual([MAFIA_ID, 'doctor']);
    expect(on(9).sort()).toEqual([MAFIA_ID, 'doctor', 'police', 'sheriff'].sort());
    expect(on(13)).toHaveLength(6);
  });

  it('never needs more roles than players across 4–30', () => {
    for (let n = 4; n <= 30; n++) {
      const s = summarizeRoles(applyPreset(defaultRoles(), n), n);
      expect(s.errors, `n=${n}`).toEqual([]);
      expect(s.villagers, `n=${n}`).toBeGreaterThan(0);
    }
  });

  it('keeps edited names and custom roles', () => {
    let roles = unwrap(updateRole(defaultRoles(), 'doctor', { name: 'Medic' }));
    roles = unwrap(addRole(roles, { name: 'Spy', team: 'mafia' }));
    const next = applyPreset(roles, 8);
    expect(byId(next, 'doctor').name).toBe('Medic');
    expect(next.find((r) => r.name === 'Spy')).toMatchObject({ enabled: true, count: 1 });
  });
});

describe('summary and validation', () => {
  it('fills the rest with Villagers', () => {
    const roles = applyPreset(defaultRoles(), 8); // 2 mafia + doctor + sheriff
    expect(summarizeRoles(roles, 8)).toMatchObject({ special: 4, villagers: 4, mafia: 2, errors: [] });
  });

  it('rejects more roles than players', () => {
    const roles = unwrap(updateRole(defaultRoles(), MAFIA_ID, { count: 5 }));
    expect(summarizeRoles(roles, 4).errors.map((e) => e.code)).toContain('tooManyRoles');
  });

  it('requires a minimum of 4 players', () => {
    expect(summarizeRoles(defaultRoles(), 3).errors).toContainEqual({ code: 'notEnoughPlayers', params: { min: 4, n: 3 } });
  });

  it('warns when Mafia are half the table', () => {
    const roles = unwrap(updateRole(defaultRoles(), MAFIA_ID, { count: 3 }));
    expect(summarizeRoles(roles, 6).warnings).toHaveLength(1);
  });

  it('roles in play have no counts and include Villager only if any seats are left', () => {
    const roles = unwrap(updateRole(defaultRoles(), MAFIA_ID, { count: 4 }));
    const full = rolesInPlay(roles, 4);
    expect(full.map((r) => r.id)).toEqual([MAFIA_ID]);
    expect(Object.keys(full[0]!).sort()).toEqual(['description', 'id', 'name', 'team']);
    expect(rolesInPlay(roles, 6).map((r) => r.id)).toEqual([MAFIA_ID, VILLAGER_ID]);
  });
});

describe('role edits', () => {
  it('Mafia and Villager cannot be turned off, deleted or have Mafia set to 0', () => {
    const roles = defaultRoles();
    expect(updateRole(roles, MAFIA_ID, { enabled: false }).ok).toBe(false);
    expect(updateRole(roles, VILLAGER_ID, { enabled: false }).ok).toBe(false);
    expect(updateRole(roles, MAFIA_ID, { count: 0 }).ok).toBe(false);
    expect(updateRole(roles, VILLAGER_ID, { count: 3 }).ok).toBe(false);
    expect(deleteRole(roles, MAFIA_ID).ok).toBe(false);
    expect(updateRole(roles, MAFIA_ID, { team: 'town' }).ok).toBe(false);
  });

  it('optional roles: count 0 turns off, enabling sets count 1', () => {
    let roles = unwrap(updateRole(defaultRoles(), 'doctor', { enabled: true }));
    expect(byId(roles, 'doctor')).toMatchObject({ enabled: true, count: 1 });
    roles = unwrap(updateRole(roles, 'doctor', { count: 0 }));
    expect(byId(roles, 'doctor')).toMatchObject({ enabled: false, count: 0 });
    roles = unwrap(updateRole(roles, 'doctor', { count: 2.7 }));
    expect(byId(roles, 'doctor')).toMatchObject({ enabled: true, count: 2 });
  });

  it('default roles can be renamed but not deleted', () => {
    const roles = unwrap(updateRole(defaultRoles(), 'sheriff', { name: '  Detective ', description: 'Checks.' }));
    expect(byId(roles, 'sheriff')).toMatchObject({ name: 'Detective', description: 'Checks.' });
    expect(deleteRole(roles, 'sheriff').ok).toBe(false);
  });

  it('rejects empty and duplicate names, cleans and caps text', () => {
    const roles = defaultRoles();
    expect(updateRole(roles, 'doctor', { name: '   ' }).ok).toBe(false);
    expect(updateRole(roles, 'doctor', { name: 'mafia' }).ok).toBe(false);
    expect(addRole(roles, { name: 'SHERIFF' }).ok).toBe(false);
    const long = unwrap(addRole(roles, { name: 'X'.repeat(80), description: 'y'.repeat(500) }));
    const added = long.at(-1)!;
    expect(added.name.length).toBe(24);
    expect(added.description.length).toBe(200);
  });

  it('custom roles can be added, edited and deleted', () => {
    let roles = unwrap(addRole(defaultRoles(), { name: 'Spy', description: 'Sneaky', team: 'mafia' }));
    const spy = roles.at(-1)!;
    expect(spy).toMatchObject({ isDefault: false, required: false, enabled: true, count: 1, team: 'mafia' });
    roles = unwrap(updateRole(roles, spy.id, { team: 'neutral', count: 2 }));
    expect(byId(roles, spy.id)).toMatchObject({ team: 'neutral', count: 2 });
    roles = unwrap(deleteRole(roles, spy.id));
    expect(roles.find((r) => r.id === spy.id)).toBeUndefined();
  });

  it('rejects unknown teams and junk payloads', () => {
    expect(addRole(defaultRoles(), { name: 'A', team: 'aliens' }).ok).toBe(false);
    expect(updateRole(defaultRoles(), 'doctor', null).ok).toBe(false);
    expect(updateRole(defaultRoles(), 'doctor', { count: 'lots' }).ok).toBe(false);
    expect(updateRole(defaultRoles(), 'nope', { count: 1 }).ok).toBe(false);
  });
});

describe('room roles and settings', () => {
  let clock = 0;
  let rm: RoomManager;
  let code = '';
  let hostId = '';

  beforeEach(() => {
    clock = 1000;
    rm = new RoomManager({ now: () => clock });
    const s = unwrap(rm.createRoom('Host', 'h'));
    code = s.code;
    hostId = s.playerId;
    for (const [i, name] of ['A', 'B', 'C', 'D', 'E', 'F'].entries()) unwrap(rm.joinRoom(code, name, `p${i}`));
  });

  const hostView = () => rm.publicState(code, hostId)!;

  it('host moderates by default, so the host is not counted', () => {
    expect(hostView().settings.hostPlays).toBe(false);
    expect(hostView().playersInGame).toBe(6);
  });

  it('only the host receives role counts', () => {
    const a = rm.lookup('p0')!.playerId;
    expect(hostView().roles).not.toBeNull();
    expect(rm.publicState(code, a)!.roles).toBeNull();
    expect(rm.publicState(code, a)!.rolesCustomized).toBeNull();
    expect(rm.publicState(code)!.roles).toBeNull();
    expect(JSON.stringify(rm.publicState(code, a))).not.toMatch(/"count"/);
  });

  it('follows the preset as players join, until the host edits', () => {
    expect(byId(hostView().roles!, MAFIA_ID).count).toBe(2); // 6 players
    unwrap(rm.joinRoom(code, 'G', 'p6'));
    unwrap(rm.joinRoom(code, 'H', 'p7'));
    unwrap(rm.joinRoom(code, 'I', 'p8'));
    unwrap(rm.joinRoom(code, 'J', 'p9')); // 10 players
    expect(byId(hostView().roles!, MAFIA_ID).count).toBe(3);

    unwrap(rm.updateRole('h', MAFIA_ID, { count: 1 }));
    expect(hostView().rolesCustomized).toBe(true);
    rm.leave('p9');
    expect(byId(hostView().roles!, MAFIA_ID).count).toBe(1);

    unwrap(rm.usePreset('h'));
    expect(hostView().rolesCustomized).toBe(false);
    expect(byId(hostView().roles!, MAFIA_ID).count).toBe(2); // 9 players
  });

  it('turning host-plays on adds the host to the count', () => {
    unwrap(rm.updateSettings('h', { hostPlays: true }));
    expect(hostView().playersInGame).toBe(7);
  });

  it('clamps reveal seconds', () => {
    unwrap(rm.updateSettings('h', { revealSeconds: 999 }));
    expect(hostView().settings.revealSeconds).toBe(15);
    expect(rm.updateSettings('h', { revealSeconds: 'x' }).ok).toBe(false);
  });

  it('non-hosts cannot edit anything', () => {
    expect(rm.updateRole('p0', MAFIA_ID, { count: 3 }).ok).toBe(false);
    expect(rm.addRole('p0', { name: 'Spy' }).ok).toBe(false);
    expect(rm.deleteRole('p0', 'doctor').ok).toBe(false);
    expect(rm.usePreset('p0').ok).toBe(false);
    expect(rm.updateSettings('p0', { hostPlays: true }).ok).toBe(false);
    expect(rm.updateRole('stranger', MAFIA_ID, { count: 3 }).ok).toBe(false);
    expect(hostView().rolesCustomized).toBe(false);
  });

  it('a new host inherits the role setup', () => {
    unwrap(rm.addRole('h', { name: 'Spy' }));
    rm.leave('h');
    const newHost = rm.publicState(code)!.hostId;
    const roles = rm.publicState(code, newHost)!.roles!;
    expect(roles.some((r) => r.name === 'Spy')).toBe(true);
  });
});
