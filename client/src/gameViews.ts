// In-game panels: the private role card, moderator view, waiting view and host controls.
import type { PublicRoomState, RoleInfo } from '../../shared/types';
import * as act from './actions';
import { h } from './dom';
import { roleDesc, roleName, t } from './i18n';
import { FEDORA, HAT_PALETTE, pixelArt, roleIcon } from './pixel';
import { infoRow } from './roleViews';
import { refresh, ui } from './ui';
import { confirmButton, teamTag } from './widgets';

let revealTimer: number | undefined;
let countdownTimer: number | undefined;

/** Stop timers owned by the previous render. Called at the start of every render. */
export function clearGameTimers(): void {
  window.clearTimeout(revealTimer);
  window.clearInterval(countdownTimer);
}

/**
 * Role card. Face-down by default (including after refresh or reconnect).
 * Tap to reveal, tap again to hide; hides itself after the room's reveal time.
 */
export function roleCard(role: RoleInfo, revealSeconds: number): HTMLElement {
  const until = ui.revealUntil;
  const up = until !== null && until > Date.now();
  if (!up) ui.revealUntil = null;

  const countdown = h('span', { class: 'card__timer' });
  const bar = h('span', { class: 'card__bar' });

  const card = h('button', {
    // No team in the class: nothing about the card's look depends on the role.
    class: `card${up ? ' is-up' : ''}`, type: 'button',
    'aria-pressed': String(up),
    'aria-label': t('game.cardAria', { state: up ? `${roleName(role)}. ${t('game.tapHide')}` : t('game.tapReveal') }),
    onclick: () => {
      ui.revealUntil = ui.revealUntil ? null : Date.now() + revealSeconds * 1000;
      refresh();
    },
  },
    h('span', { class: 'card__inner' },
      h('span', { class: 'card__face card__back', 'aria-hidden': 'true' },
        pixelArt(FEDORA, HAT_PALETTE, 8),
        h('span', { class: 'card__cta' }, t('game.tapReveal')),
      ),
      h('span', { class: 'card__face card__front', 'aria-hidden': String(!up) },
        // Content only exists in the DOM while face-up, so nothing leaks via text selection or zoom.
        ...(up
          ? [
              h('span', { class: 'card__kicker' }, t('game.yourRole')),
              h('span', { class: 'card__icon' }, roleIcon(role.id, 8)),
              h('span', { class: 'card__name' }, roleName(role)),
              teamTag(role.team),
              h('span', { class: 'card__desc' }, roleDesc(role)),
              h('span', { class: 'card__foot' }, countdown, h('span', { class: 'card__hint' }, t('game.tapHide'))),
              bar,
            ]
          : []),
      ),
    ),
  );

  if (up && until !== null) {
    const total = revealSeconds * 1000;
    const tick = () => {
      const left = Math.max(0, until - Date.now());
      countdown.textContent = t('game.hidesIn', { s: Math.ceil(left / 1000) });
      bar.style.width = `${(left / total) * 100}%`;
    };
    tick();
    countdownTimer = window.setInterval(tick, 200);
    revealTimer = window.setTimeout(() => { ui.revealUntil = null; refresh(); }, until - Date.now());
  }

  return h('div', { class: 'card-wrap' }, card, h('p', { class: 'hint hint--center' }, t('game.keepSecret')));
}

export function moderatorPanel(state: PublicRoomState): HTMLElement {
  const everyone = state.you?.everyone ?? null;
  return h('div', { class: 'panel' },
    h('p', { class: 'label' }, t('game.moderating')),
    h('p', { class: 'hint' }, t('game.moderatingHint')),
    everyone
      ? h('div', { class: 'reveal-all' },
          h('button', {
            class: `btn btn--wide${ui.showAll ? ' btn--armed' : ''}`, type: 'button', 'aria-pressed': String(ui.showAll),
            onclick: () => { ui.showAll = !ui.showAll; refresh(); },
          }, ui.showAll ? t('game.hideAll') : t('game.showAll')),
          ...(ui.showAll
            ? [
                h('p', { class: 'hint' }, t('game.allRolesHint')),
                h('ul', { class: 'assignments' },
                  ...[...everyone]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((a) => h('li', { class: 'assignment' },
                      h('span', { class: 'assignment__player' }, a.name),
                      h('span', { class: 'assignment__role' }, roleIcon(a.role.id, 2), roleName(a.role)),
                      teamTag(a.role.team),
                    ))),
              ]
            : []),
        )
      : null,
  );
}

export function waitingPanel(): HTMLElement {
  return h('div', { class: 'panel panel--center' },
    h('p', { class: 'blink-slow' }, t('game.waitingNext')),
  );
}

export function gameRolesPanel(state: PublicRoomState): HTMLElement {
  return h('div', { class: 'panel' },
    h('p', { class: 'label' }, t('roles.inPlay')),
    h('ul', { class: 'roles' }, ...state.rolesInPlay.map(infoRow)),
  );
}

export function hostControls(): HTMLElement {
  return h('div', { class: 'panel' },
    h('p', { class: 'label' }, t('game.hostControls')),
    h('p', { class: 'hint' }, t('game.reshuffleHint')),
    h('div', { class: 'row row--controls' },
      confirmButton('reshuffle', t('game.reshuffle'), () => void act.reshuffle(), { cls: 'btn--primary' }),
      confirmButton('end', t('game.end'), () => void act.endGame(), { cls: 'btn--ghost' }),
    ),
  );
}
