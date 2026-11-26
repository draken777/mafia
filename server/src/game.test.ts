import { beforeEach, describe, expect, it } from 'vitest';
import { MAFIA_ID, VILLAGER_ID, buildSlots, defaultRoles } from '../../shared/roles';
import { dealRoles, shuffle } from './deal';
import { RoomManager } from './rooms';

const unwrap = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe('shuffle and deal', () => {
  it('Fisher-Yates keeps every item exactly once', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const out = shuffle([...items]);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
  });

  it('is deterministic with an injected random source', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
  });

  it('builds one slot per player, filling with Villagers', () => {
    const roles = defaultRoles().map((r) =>
      r.id === MAFIA_ID ? { ...r, count: 2 } : r.id === 'doctor' ? { ...r, enabled: true, count: 1 } : r);
    const slots = buildSlots(roles, 7).map((r) => r.id);
    expect(slots.filter((id) => id === MAFIA_ID)).toHaveLength(2);
    expect(slots.filter((id) => id === 'doctor')).toHaveLength(1);
    expect(slots.filter((id) => id === VILLAGER_ID)).toHaveLength(4);
  });

  it('rejects too many roles, too few players and no Mafia', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
    const many = defaultRoles().map((r) => (r.id === MAFIA_ID ? { ...r, count: 6 } : r));
    expect(dealRoles(many, ids(5))).toMatchObject({ ok: false, problem: { code: 'tooManyRoles' } });
    expect(dealRoles(defaultRoles(), ids(3))).toMatchObject({ ok: false, problem: { code: 'notEnoughPlayers' } });
    const noMafia = defaultRoles().map((r) => (r.id === MAFIA_ID ? { ...r, team: 'town' as const } : r));
    expect(dealRoles(noMafia, ids(5))).toMatchObject({ ok: false, problem: { code: 'noMafia' } });
  });

  it('spreads roles roughly evenly over many deals', () => {
    const roles = defaultRoles();
    const hits = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const d = dealRoles(roles, ['a', 'b', 'c', 'd']);
      if (!d.ok) throw new Error();
      for (const [pid, rid] of d.assignments) if (rid === MAFIA_ID) hits.set(pid, (hits.get(pid) ?? 0) + 1);
    }
    for (const id of ['a', 'b', 'c', 'd']) expect(hits.get(id)).toBeGreaterThan(850); // expect ~1000 each
  });
});

describe('game flow in a room', () => {
  let rm: RoomManager;
  let code = '';
  let hostId = '';
  const sockets = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];
  const pid = (sock: string) => rm.lookup(sock)!.playerId;
  const view = (sock: string) => rm.publicState(code, pid(sock))!;

  beforeEach(() => {
    rm = new RoomManager({ now: () => 1000 });
    const s = unwrap(rm.createRoom('Host', 'h'));
    code = s.code;
    hostId = s.playerId;
    sockets.forEach((sock, i) => unwrap(rm.joinRoom(code, `P${i}`, sock)));
  });

  it('only the host can start, and the host moderates by default', () => {
    expect(rm.startGame('p0').ok).toBe(false);
    unwrap(rm.startGame('h'));
    const hv = rm.publicState(code, hostId)!;
    expect(hv.phase).toBe('game');
    expect(hv.round).toBe(1);
    expect(hv.you).toEqual({ status: 'moderating', role: null, everyone: null });
    expect(hv.players.find((p) => p.isHost)!.inRound).toBe(false);
  });

  it('each player sees only their own role, and counts match the setup', () => {
    unwrap(rm.startGame('h'));
    const ids = sockets.map((s) => view(s).you!.role!.id);
    // 6 players → preset: 2 Mafia + Doctor, rest Villagers
    expect(ids.filter((id) => id === MAFIA_ID)).toHaveLength(2);
    expect(ids.filter((id) => id === 'doctor')).toHaveLength(1);
    expect(ids.filter((id) => id === VILLAGER_ID)).toHaveLength(3);
    for (const s of sockets) {
      const v = view(s);
      expect(v.you!.status).toBe('playing');
      expect(v.you!.everyone).toBeNull();
      // nothing in the snapshot ties any other player to a role
      const json = JSON.stringify(v);
      for (const other of sockets.filter((o) => o !== s)) {
        expect(json.includes(`"playerId":"${pid(other)}"`)).toBe(false);
      }
    }
    // the anonymous snapshot (no viewer) has no role at all
    expect(rm.publicState(code)!.you).toBeNull();
  });

  it('moderator sees every assignment only with the setting on', () => {
    unwrap(rm.updateSettings('h', { moderatorSeesRoles: true }));
    unwrap(rm.startGame('h'));
    const everyone = rm.publicState(code, hostId)!.you!.everyone!;
    expect(everyone).toHaveLength(6);
    for (const a of everyone) {
      const sock = sockets.find((s) => pid(s) === a.playerId)!;
      expect(view(sock).you!.role!.id).toBe(a.role.id);
    }
    // players never get the list, even with the setting on
    for (const s of sockets) expect(view(s).you!.everyone).toBeNull();
  });

  it('a playing host gets a role and never the full list', () => {
    unwrap(rm.updateSettings('h', { hostPlays: true, moderatorSeesRoles: true }));
    unwrap(rm.startGame('h'));
    const you = rm.publicState(code, hostId)!.you!;
    expect(you.status).toBe('playing');
    expect(you.role).not.toBeNull();
    expect(you.everyone).toBeNull();
  });

  it('host transfer mid-game never hands the list to a player', () => {
    unwrap(rm.updateSettings('h', { moderatorSeesRoles: true }));
    unwrap(rm.startGame('h'));
    rm.leave('h');
    const newHost = rm.publicState(code)!.hostId;
    const sock = sockets.find((s) => pid(s) === newHost)!;
    expect(view(sock).you).toMatchObject({ status: 'playing', everyone: null });
  });

  it('roles and settings are locked during a game', () => {
    unwrap(rm.startGame('h'));
    expect(rm.updateRole('h', MAFIA_ID, { count: 1 })).toMatchObject({ ok: false, error: 'gameRunning' });
    expect(rm.updateSettings('h', { hostPlays: true })).toMatchObject({ ok: false, error: 'gameRunning' });
    expect(rm.startGame('h')).toMatchObject({ ok: false, error: 'gameRunning' });
  });

  it('a disconnected seat keeps its role and round', () => {
    unwrap(rm.startGame('h'));
    unwrap(rm.joinRoom(code, 'Tab', 'tab')); // separate session we can resume with a known token
    rm.leave('tab');
    const p2 = pid('p2');
    const before = view('p2').you!.role!.id;
    rm.disconnect('p2');
    expect(view('p0').players.find((p) => p.id === p2)!.inRound).toBe(true);
    expect(rm.publicState(code, p2)!.you!.role!.id).toBe(before);
    expect(view('p0').round).toBe(1);
  });

  it('late joiners wait, then get a role on reshuffle', () => {
    unwrap(rm.startGame('h'));
    unwrap(rm.joinRoom(code, 'Late', 'late'));
    expect(view('late').you).toEqual({ status: 'waiting', role: null, everyone: null });
    expect(view('late').players.find((p) => p.name === 'Late')!.inRound).toBe(false);
    expect(rm.reshuffle('p0').ok).toBe(false);
    unwrap(rm.reshuffle('h'));
    expect(view('late').you!.status).toBe('playing');
    expect(view('late').round).toBe(2);
  });

  it('leaving mid-game drops the role; roles in play stay those dealt', () => {
    unwrap(rm.startGame('h'));
    rm.leave('p5');
    expect(view('p0').playersInGame).toBe(5);
    expect(view('p0').rolesInPlay.map((r) => r.id)).toContain(MAFIA_ID);
  });

  it('reshuffle fails cleanly if too many people left', () => {
    unwrap(rm.startGame('h'));
    rm.leave('p5');
    rm.leave('p4');
    rm.leave('p3'); // 3 players left
    expect(rm.reshuffle('h')).toMatchObject({ ok: false, error: 'notEnoughPlayers' });
    expect(view('p0').phase).toBe('game');
  });

  it('end game returns everyone to the lobby with no roles', () => {
    unwrap(rm.startGame('h'));
    expect(rm.endGame('p0').ok).toBe(false);
    unwrap(rm.endGame('h'));
    for (const s of sockets) {
      expect(view(s).phase).toBe('lobby');
      expect(view(s).you).toBeNull();
      expect(view(s).players.every((p) => !p.inRound)).toBe(true);
    }
    expect(rm.endGame('h')).toMatchObject({ ok: false, error: 'gameNotRunning' });
  });

  it('start is refused when the setup is invalid', () => {
    unwrap(rm.updateRole('h', MAFIA_ID, { count: 9 }));
    expect(rm.startGame('h')).toMatchObject({ ok: false, error: 'tooManyRoles', params: { roles: 10, n: 6 } }); // 9 Mafia + preset Doctor
  });
});

describe('resume with token mid-game', () => {
  it('returns the same role after a refresh', () => {
    const rm = new RoomManager({ now: () => 1 });
    const host = unwrap(rm.createRoom('Host', 'h'));
    const sessions = ['a', 'b', 'c', 'd'].map((n) => unwrap(rm.joinRoom(host.code, n, `s-${n}`)));
    unwrap(rm.startGame('h'));
    const me = sessions[1]!;
    const before = rm.publicState(host.code, me.playerId)!.you!.role!.id;
    rm.disconnect('s-b');
    const res = unwrap(rm.resume(host.code, me.token, 's-b2'));
    expect(res.playerId).toBe(me.playerId);
    expect(rm.publicState(host.code, me.playerId)!.you!.role!.id).toBe(before);
    expect(rm.publicState(host.code, me.playerId)!.round).toBe(1);
  });
});
