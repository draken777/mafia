import { describe, expect, it, beforeEach } from 'vitest';
import { CODE_ALPHABET } from '../../shared/limits';
import { generateCode } from './codes';
import { EMPTY_ROOM_MS, HOST_GRACE_MS, IDLE_ROOM_MS, RoomManager } from './rooms';

let clock = 0;
let rm: RoomManager;

function setup() {
  clock = 1_000_000;
  rm = new RoomManager({ now: () => clock });
}

function hostRoom(name = 'Alice', sock = 'h') {
  const r = rm.createRoom(name, sock);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

function join(code: string, name: string, sock: string) {
  const r = rm.joinRoom(code, name, sock);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

describe('room codes', () => {
  it('uses only allowed letters and never O, I or L', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode(() => false);
      expect(code).toMatch(/^[A-Z]{4}$/);
      expect(code).not.toMatch(/[OIL]/);
      for (const c of code) expect(CODE_ALPHABET).toContain(c);
    }
  });

  it('retries on collision', () => {
    const seq = [0, 0, 0, 0, 1, 1, 1, 1];
    let i = 0;
    const code = generateCode((c) => c === 'AAAA', () => seq[i++]!);
    expect(code).toBe('BBBB');
  });

  it('throws when it cannot find a free code', () => {
    expect(() => generateCode(() => true, () => 0, 10)).toThrow();
  });
});

describe('create and join', () => {
  beforeEach(setup);

  it('creates a room with the creator as host', () => {
    const s = hostRoom();
    const st = rm.publicState(s.code)!;
    expect(st.hostId).toBe(s.playerId);
    expect(st.players).toEqual([{ id: s.playerId, name: 'Alice', connected: true, isHost: true, inRound: false }]);
  });

  it('rejects empty names', () => {
    expect(rm.createRoom('   ', 'x').ok).toBe(false);
    const s = hostRoom();
    expect(rm.joinRoom(s.code, '', 'b').ok).toBe(false);
  });

  it('rejects duplicate names case-insensitively', () => {
    const s = hostRoom('Alice');
    const r = rm.joinRoom(s.code, '  alice ', 'b');
    expect(r).toEqual({ ok: false, error: 'nameTaken' });
  });

  it('accepts lowercase codes and rejects unknown ones', () => {
    const s = hostRoom();
    expect(rm.joinRoom(s.code.toLowerCase(), 'Bob', 'b').ok).toBe(true);
    expect(rm.joinRoom('ZZZZ', 'Cy', 'c').ok).toBe(rm.hasRoom('ZZZZ'));
    expect(rm.joinRoom('AB', 'Cy', 'c').ok).toBe(false);
  });

  it('cleans and caps names, and never exposes tokens in public state', () => {
    const s = hostRoom();
    join(s.code, 'Bob\u0000​   the   Builder of Very Long Names', 'b');
    const st = rm.publicState(s.code)!;
    const bob = st.players[1]!;
    expect(bob.name).toBe('Bob the Builder');
    expect(bob.name.length).toBeLessThanOrEqual(16);
    expect(JSON.stringify(st)).not.toContain(s.token);
  });

  it('lists players in join order', () => {
    const s = hostRoom();
    join(s.code, 'Bob', 'b');
    join(s.code, 'Cy', 'c');
    expect(rm.publicState(s.code)!.players.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Cy']);
  });
});

describe('kick', () => {
  beforeEach(setup);

  it('lets the host kick and reports the kicked socket', () => {
    const s = hostRoom();
    const bob = join(s.code, 'Bob', 'b');
    const r = rm.kick('h', bob.playerId);
    expect(r.ok && r.data.kickedSocketId).toBe('b');
    expect(rm.publicState(s.code)!.players).toHaveLength(1);
    expect(rm.lookup('b')).toBeUndefined();
  });

  it('refuses kicks from non-hosts, even naming the host id', () => {
    const s = hostRoom();
    const bob = join(s.code, 'Bob', 'b');
    const cy = join(s.code, 'Cy', 'c');
    expect(rm.kick('b', cy.playerId).ok).toBe(false);
    expect(rm.kick('b', s.playerId).ok).toBe(false);
    expect(rm.kick('nobody', bob.playerId).ok).toBe(false);
    expect(rm.publicState(s.code)!.players).toHaveLength(3);
  });

  it('kicked token cannot resume', () => {
    const s = hostRoom();
    const bob = join(s.code, 'Bob', 'b');
    rm.kick('h', bob.playerId);
    expect(rm.resume(s.code, bob.token, 'b2').ok).toBe(false);
  });
});

describe('leave and host transfer', () => {
  beforeEach(setup);

  it('closes the room when the last player leaves', () => {
    const s = hostRoom();
    const ev = rm.leave('h');
    expect(ev[0]).toMatchObject({ type: 'closed', code: s.code });
    expect(rm.hasRoom(s.code)).toBe(false);
  });

  it('passes host to the earliest connected player when the host leaves', () => {
    const s = hostRoom();
    const bob = join(s.code, 'Bob', 'b');
    join(s.code, 'Cy', 'c');
    rm.disconnect('b'); // Bob is away, so Cy should get host
    rm.leave('h');
    const st = rm.publicState(s.code)!;
    expect(st.hostId).not.toBe(bob.playerId);
    expect(st.players.find((p) => p.isHost)!.name).toBe('Cy');
    expect(st.hostGraceUntil).toBeNull();
  });
});

describe('disconnect, rejoin and grace period', () => {
  beforeEach(setup);

  it('keeps the seat on disconnect and restores it with the token', () => {
    const s = hostRoom();
    const bob = join(s.code, 'Bob', 'b');
    rm.disconnect('b');
    expect(rm.publicState(s.code)!.players[1]!.connected).toBe(false);
    const r = rm.resume(s.code, bob.token, 'b2');
    expect(r.ok && r.data.playerId).toBe(bob.playerId);
    expect(rm.publicState(s.code)!.players[1]!.connected).toBe(true);
    expect(rm.lookup('b2')).toEqual({ code: s.code, playerId: bob.playerId });
  });

  it('rejects bad tokens', () => {
    const s = hostRoom();
    expect(rm.resume(s.code, 'nope', 'x').ok).toBe(false);
    expect(rm.resume('ZZZZ', s.token, 'x').ok).toBe(false);
  });

  it('a second tab takes over the seat and reports the old socket', () => {
    const s = hostRoom();
    const r = rm.resume(s.code, s.token, 'h2');
    expect(r.ok && r.data.replacedSocketId).toBe('h');
    expect(rm.lookup('h')).toBeUndefined();
    // the old socket disconnecting later must not mark the seat away
    rm.disconnect('h');
    expect(rm.publicState(s.code)!.players[0]!.connected).toBe(true);
  });

  it('host keeps the seat if back within the grace period', () => {
    const s = hostRoom();
    join(s.code, 'Bob', 'b');
    rm.disconnect('h');
    expect(rm.publicState(s.code)!.hostGraceUntil).toBe(clock + HOST_GRACE_MS);
    clock += HOST_GRACE_MS - 1;
    rm.tick();
    rm.resume(s.code, s.token, 'h2');
    clock += 10 * HOST_GRACE_MS;
    rm.tick();
    const st = rm.publicState(s.code)!;
    expect(st.hostId).toBe(s.playerId);
    expect(st.hostGraceUntil).toBeNull();
  });

  it('transfers host after the grace period; old host stays as a player', () => {
    const s = hostRoom();
    const bob = join(s.code, 'Bob', 'b');
    rm.disconnect('h');
    clock += HOST_GRACE_MS;
    const ev = rm.tick();
    expect(ev).toContainEqual({ type: 'state', code: s.code });
    expect(rm.publicState(s.code)!.hostId).toBe(bob.playerId);
    // Old host rejoins as a regular player and cannot kick
    rm.resume(s.code, s.token, 'h2');
    expect(rm.kick('h2', bob.playerId).ok).toBe(false);
  });

  it('closes the room after grace when nobody else is connected', () => {
    const s = hostRoom();
    join(s.code, 'Bob', 'b');
    rm.disconnect('b');
    rm.disconnect('h');
    clock += HOST_GRACE_MS;
    const ev = rm.tick();
    expect(ev[0]).toMatchObject({ type: 'closed', code: s.code });
    expect(rm.hasRoom(s.code)).toBe(false);
  });
});

describe('idle cleanup', () => {
  beforeEach(setup);

  it('closes rooms with no activity', () => {
    const s = hostRoom();
    clock += IDLE_ROOM_MS - 1;
    expect(rm.tick()).toEqual([]);
    clock += 1;
    const ev = rm.tick();
    expect(ev[0]).toMatchObject({ type: 'closed', code: s.code, socketIds: ['h'] });
  });

  it('closes rooms where everyone has been gone long enough', () => {
    const s = hostRoom();
    const bob = join(s.code, 'Bob', 'b');
    rm.kick('h', bob.playerId);
    rm.disconnect('h');
    clock += HOST_GRACE_MS; // grace ends first but nobody to hand over to
    rm.tick();
    expect(rm.hasRoom(s.code)).toBe(false);
  });

  it('a non-host room with everybody away expires after EMPTY_ROOM_MS', () => {
    const s = hostRoom();
    join(s.code, 'Bob', 'b');
    rm.disconnect('b');
    // host stays "connected" in the model but let's simulate host reconnect cycles
    rm.disconnect('h');
    rm.resume(s.code, s.token, 'h2');
    rm.disconnect('h2');
    clock += EMPTY_ROOM_MS;
    rm.tick();
    expect(rm.hasRoom(s.code)).toBe(false);
  });
});

describe('rate limiter', () => {
  it('allows up to the limit per window, then resets', async () => {
    const { RateLimiter } = await import('./rateLimit');
    let t = 0;
    const rl = new RateLimiter(3, 1000, () => t);
    expect([rl.take('ip'), rl.take('ip'), rl.take('ip'), rl.take('ip')]).toEqual([true, true, true, false]);
    expect(rl.take('other')).toBe(true); // keys are independent
    t = 1000;
    expect(rl.take('ip')).toBe(true);
    t = 5000;
    rl.sweep();
    expect(rl.size).toBe(0);
  });
});
