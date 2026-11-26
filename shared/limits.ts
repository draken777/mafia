// Limits and validation helpers used by both sides. The server always re-validates.

/** Room code alphabet: A–Z without the look-alikes O, I, L. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

export const NAME_MAX = 16;
export const ROLE_NAME_MAX = 24;
export const ROLE_DESC_MAX = 200;
/** Total roles (default + custom) a room can define. */
export const MAX_ROLES = 24;
export const REVEAL_SECONDS_MIN = 2;
export const REVEAL_SECONDS_MAX = 15;

/** Group size is 4–30 players (ROADMAP decisions). */
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 30;
/** Rooms one server holds at once (memory guard). */
export const MAX_ROOMS = 2000;

/** Uppercase and drop anything that cannot appear in a code. */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/**
 * Clean free text: strip control/format characters, collapse whitespace, trim, cap length.
 * Output is still rendered with textContent only; this just keeps it tidy and bounded.
 */
export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trimEnd();
}
