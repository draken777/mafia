// Client-only UI state that must survive re-renders (drafts, open editors, errors, card reveal).
// Server state is never stored here; it always comes fresh from the latest room snapshot.
// Nothing here is persisted, so a refresh always starts with the role card hidden.
import type { ErrorCode, MessageParams } from '../../shared/errors';
import type { TeamTag } from '../../shared/types';

export interface RoleDraft {
  name: string;
  description: string;
  team: TeamTag;
}

export interface UiError {
  code: ErrorCode;
  params?: MessageParams;
}

export const ui = {
  home: { name: null as string | null, code: '' },
  /** Role currently being edited by the host, with unsaved values. */
  editing: null as (RoleDraft & { id: string }) | null,
  /** "Add role" form; null when closed. */
  adding: null as RoleDraft | null,
  /** Last error from a lobby/game action, shown until the next action. */
  lobbyError: null as UiError | null,
  /** Two-tap confirm buttons: which one is armed (e.g. "kick:<id>", "reshuffle", "end"). */
  armed: null as string | null,
  /** Role card face-up until this time (epoch ms); null when hidden. */
  revealUntil: null as number | null,
  /** Moderator's full list shown. */
  showAll: false,
  /** Round seen last, to spot a new deal. */
  lastRound: null as number | null,
  /** Show the "new round" banner. */
  newRound: false,
};

let rerender: () => void = () => {};

export function setRerender(fn: () => void): void {
  rerender = fn;
}

export function refresh(): void {
  rerender();
}

/** Hide everything secret: role card and moderator list. */
export function hideSecrets(): void {
  if (ui.revealUntil === null && !ui.showAll) return;
  ui.revealUntil = null;
  ui.showAll = false;
  rerender();
}
