// Role assignment. Runs on the server only; results never leave it except one role per player.
import { randomInt } from 'node:crypto';
import { buildSlots, summarizeRoles } from '../../shared/roles';
import type { Problem } from '../../shared/errors';
import type { Role } from '../../shared/types';
import type { RandomInt } from './codes';

/** In-place Fisher-Yates shuffle. */
export function shuffle<T>(items: T[], rand: RandomInt = (n) => randomInt(n)): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/**
 * Assign one role id to each player id, or report why the setup can't be dealt
 * (too few players, no Mafia, more roles than players).
 */
export function dealRoles(
  roles: Role[],
  playerIds: string[],
  rand?: RandomInt,
): { ok: true; assignments: Map<string, string> } | { ok: false; problem: Problem } {
  const summary = summarizeRoles(roles, playerIds.length);
  const problem = summary.errors[0];
  if (problem) return { ok: false, problem };
  const slots = shuffle(buildSlots(roles, playerIds.length), rand);
  return { ok: true, assignments: new Map(playerIds.map((id, i) => [id, slots[i]!.id])) };
}
