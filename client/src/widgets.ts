// Small reusable UI pieces.
import type { RoleInfo, TeamTag } from '../../shared/types';
import { h } from './dom';
import { LANGS, errorText, getLang, setLang, t, teamName } from './i18n';
import { refresh, ui } from './ui';

export function teamTag(team: TeamTag): HTMLElement {
  return h('span', { class: `tag tag--team tag--${team}` }, teamName(team));
}

export function stepper(value: string, label: string, onDown: (() => void) | null, onUp: (() => void) | null): HTMLElement {
  return h('div', { class: 'stepper', role: 'group', 'aria-label': label },
    h('button', { class: 'btn btn--step', type: 'button', 'aria-label': t('stepper.dec', { label }), disabled: !onDown, onclick: () => onDown?.() }, '−'),
    h('span', { class: 'stepper__value', 'aria-live': 'polite' }, value),
    h('button', { class: 'btn btn--step', type: 'button', 'aria-label': t('stepper.inc', { label }), disabled: !onUp, onclick: () => onUp?.() }, '+'),
  );
}

let armTimer: number | undefined;

/**
 * Two-tap button: the first tap arms it ("Sure?") for 3 s, the second runs `onConfirm`.
 * Armed state lives in `ui.armed` so re-renders don't reset it.
 */
export function confirmButton(
  key: string,
  label: string,
  onConfirm: () => void,
  opts: { cls?: string; aria?: string } = {},
): HTMLButtonElement {
  const armed = ui.armed === key;
  const btn = h('button', {
    class: `btn ${opts.cls ?? ''}${armed ? ' btn--armed' : ''}`, type: 'button', 'aria-label': opts.aria,
  }, armed ? t('confirm') : label);
  btn.addEventListener('click', () => {
    window.clearTimeout(armTimer);
    if (ui.armed !== key) {
      ui.armed = key;
      armTimer = window.setTimeout(() => { ui.armed = null; refresh(); }, 3000);
      refresh();
      return;
    }
    ui.armed = null;
    btn.disabled = true;
    onConfirm();
  });
  return btn;
}

export function langSwitch(): HTMLElement {
  const current = getLang();
  return h('div', { class: 'lang', role: 'group', 'aria-label': t('lang.label') },
    ...LANGS.map(({ id, label }) =>
      h('button', {
        class: `lang__btn${id === current ? ' is-on' : ''}`, type: 'button', lang: id,
        'aria-pressed': String(id === current),
        onclick: () => { if (id !== current) { setLang(id); refresh(); } },
      }, label)),
  );
}

/** Inline error from the last action, translated now (so switching language updates it too). */
export function lobbyErrorNotice(roles: RoleInfo[] | null): HTMLElement | null {
  const e = ui.lobbyError;
  return e ? h('p', { class: 'notice notice--error', role: 'alert' }, errorText(e.code, e.params, roles)) : null;
}
