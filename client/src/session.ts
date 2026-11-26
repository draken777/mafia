// Session token persistence for rejoin after refresh. Stores only code + token + own id, never a role.
import type { SessionInfo } from '../../shared/types';

const KEY = 'mafia.session';
const NAME_KEY = 'mafia.lastName';

export function loadSession(): SessionInfo | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SessionInfo>;
    if (typeof s.code === 'string' && typeof s.token === 'string' && typeof s.playerId === 'string') {
      return { code: s.code, token: s.token, playerId: s.playerId };
    }
  } catch {
    /* storage blocked or corrupt */
  }
  return null;
}

export function saveSession(s: SessionInfo): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function clearSession(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function loadLastName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

export function saveLastName(name: string): void {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}
