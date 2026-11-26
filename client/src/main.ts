import './styles.css';
import { EV } from '../../shared/events';
import { CODE_LENGTH, NAME_MAX, normalizeCode } from '../../shared/limits';
import type { PublicPlayer, PublicRoomState, SessionInfo } from '../../shared/types';
import * as act from './actions';
import { h, mount } from './dom';
import { clearGameTimers, gameRolesPanel, hostControls, moderatorPanel, roleCard, waitingPanel } from './gameViews';
import { closeText, errorText, t } from './i18n';
import { request, socket } from './net';
import { FEDORA, HAT_PALETTE, pixelArt } from './pixel';
import { hostRolesPanel, rolesInPlayPanel, settingsPanel, startBlock } from './roleViews';
import { clearSession, loadLastName, loadSession, saveLastName, saveSession } from './session';
import { hideSecrets, setRerender, ui } from './ui';
import { confirmButton, langSwitch, lobbyErrorNotice } from './widgets';

/** Notices are stored as functions so they re-translate when the language changes. */
type Notice = () => string;

type View =
  | { screen: 'home'; notice?: Notice }
  | { screen: 'loading' }
  | { screen: 'room'; state: PublicRoomState };

const app = document.getElementById('app')!;
let view: View = { screen: 'loading' };
let session: SessionInfo | null = loadSession();
let graceTimer: number | undefined;

// ---------- state transitions ----------

function show(next: View): void {
  view = next;
  render();
}

function enterSession(s: SessionInfo): void {
  session = s;
  saveSession(s);
}

function resetRoomUi(): void {
  Object.assign(ui, {
    editing: null, adding: null, lobbyError: null, armed: null,
    revealUntil: null, showAll: false, lastRound: null, newRound: false,
  });
}

function exitToHome(notice?: Notice): void {
  session = null;
  clearSession();
  resetRoomUi();
  show({ screen: 'home', notice });
}

async function tryResume(): Promise<void> {
  const s = session;
  if (!s) {
    if (view.screen === 'loading') show({ screen: 'home' });
    return;
  }
  const res = await request<SessionInfo>((ack) => socket.emit(EV.resume, { code: s.code, token: s.token }, ack));
  if (res.ok) enterSession(res.data);
  else exitToHome(() => errorText(res.error, res.params));
}

function onState(state: PublicRoomState): void {
  if (!session || state.code !== session.code) return;
  // Close the editor if the role vanished or this client is no longer host.
  if (ui.editing && !state.roles?.some((r) => r.id === ui.editing!.id)) ui.editing = null;
  if (!state.roles) ui.adding = null;

  // New deal: hide any face-up card and announce it (not on first load / refresh).
  if (state.phase === 'game' && ui.lastRound !== null && state.round !== ui.lastRound) {
    ui.revealUntil = null;
    ui.showAll = false;
    ui.newRound = true;
  }
  if (state.phase === 'lobby') {
    ui.revealUntil = null;
    ui.showAll = false;
    ui.newRound = false;
  }
  // Only remember rounds seen during a game, so the first deal after the lobby isn't announced as "new".
  ui.lastRound = state.phase === 'game' ? state.round : null;
  show({ screen: 'room', state });
}

// ---------- socket wiring ----------

socket.on('connect', () => {
  render(); // clears the offline banner
  void tryResume();
});
socket.on('disconnect', () => render());
socket.on(EV.state, onState);
socket.on(EV.kicked, () => exitToHome(() => t('lobby.kicked')));
socket.on(EV.closed, ({ reason }) => exitToHome(() => closeText(reason)));

// Hide the role card and moderator list whenever the page is hidden (phone locked, app switched).
document.addEventListener('visibilitychange', () => { if (document.hidden) hideSecrets(); });
window.addEventListener('pagehide', hideSecrets);

// ---------- actions ----------

async function createRoom(name: string, setError: (m: string) => void): Promise<void> {
  saveLastName(name);
  const res = await request<SessionInfo>((ack) => socket.emit(EV.createRoom, { name }, ack));
  if (res.ok) enterSession(res.data);
  else setError(errorText(res.error, res.params));
}

async function joinRoom(code: string, name: string, setError: (m: string) => void): Promise<void> {
  saveLastName(name);
  const res = await request<SessionInfo>((ack) => socket.emit(EV.joinRoom, { code, name }, ack));
  if (res.ok) enterSession(res.data);
  else setError(errorText(res.error, res.params));
}

async function leaveRoom(): Promise<void> {
  await request<null>((ack) => socket.emit(EV.leave, ack));
  exitToHome();
}

// ---------- rendering ----------

/** Re-render while keeping focus and caret in whichever field had them (matched by data-key). */
function render(): void {
  window.clearInterval(graceTimer);
  clearGameTimers();
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  const key = active?.dataset?.key;
  const selStart = active && 'selectionStart' in active ? active.selectionStart : null;
  const selEnd = active && 'selectionEnd' in active ? active.selectionEnd : null;

  const screen =
    view.screen === 'home' ? renderHome(view.notice)
    : view.screen === 'room' ? renderRoom(view.state)
    : renderLoading();
  mount(app,
    h('div', { class: 'topbar' }, langSwitch()),
    ...(socket.connected || view.screen === 'home' ? [] : [offlineBanner()]),
    screen,
  );

  if (key) {
    const el = app.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-key="${key}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      if (selStart !== null && 'setSelectionRange' in el && el.type !== 'select-one') {
        try { el.setSelectionRange(selStart, selEnd ?? selStart); } catch { /* not a text field */ }
      }
    }
  }
}
setRerender(render);

function offlineBanner(): HTMLElement {
  return h('div', { class: 'banner banner--warn', role: 'status' }, t('app.offline'));
}

function renderLoading(): HTMLElement {
  return h('section', { class: 'screen screen--center' }, h('p', { class: 'blink' }, t('app.connecting')));
}

function logo(): HTMLElement {
  return h('h1', { class: 'logo' }, pixelArt(FEDORA, HAT_PALETTE, 8), 'MAFIA');
}

function renderHome(notice?: Notice): HTMLElement {
  const error = h('p', { class: 'error', role: 'alert' });
  const setError = (m: string) => (error.textContent = m);
  if (ui.home.name === null) ui.home.name = loadLastName();

  const nameInput = h('input', {
    id: 'name', class: 'input', maxlength: NAME_MAX, autocomplete: 'nickname',
    placeholder: t('home.namePlaceholder'), value: ui.home.name, 'data-key': 'home-name',
  });
  nameInput.addEventListener('input', () => (ui.home.name = nameInput.value));

  const codeInput = h('input', {
    id: 'code', class: 'input input--code', maxlength: CODE_LENGTH, autocomplete: 'off',
    autocapitalize: 'characters', spellcheck: 'false', inputmode: 'text', placeholder: 'ABCD',
    value: ui.home.code, 'data-key': 'home-code', lang: 'en',
  });
  codeInput.addEventListener('input', () => {
    codeInput.value = normalizeCode(codeInput.value);
    ui.home.code = codeInput.value;
  });

  const getName = (): string | null => {
    const name = nameInput.value.trim();
    if (!name) {
      setError(t('home.needName'));
      nameInput.focus();
      return null;
    }
    return name;
  };

  const busy = (btn: HTMLButtonElement, fn: () => Promise<void>) => async () => {
    if (btn.disabled) return;
    setError('');
    btn.disabled = true;
    try { await fn(); } finally { btn.disabled = false; }
  };

  const createBtn = h('button', { class: 'btn btn--primary', type: 'button' }, t('home.create'));
  createBtn.addEventListener('click', busy(createBtn, async () => {
    const name = getName();
    if (name) await createRoom(name, setError);
  }));

  const joinBtn = h('button', { class: 'btn', type: 'submit' }, t('home.join'));
  const joinForm = h('form', { class: 'row' }, codeInput, joinBtn);
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    void busy(joinBtn, async () => {
      const name = getName();
      if (!name) return;
      if (codeInput.value.length !== CODE_LENGTH) {
        setError(errorText('codeInvalid'));
        codeInput.focus();
        return;
      }
      await joinRoom(codeInput.value, name, setError);
    })();
  });

  return h('section', { class: 'screen' },
    logo(),
    notice ? h('p', { class: 'banner banner--info', role: 'status' }, notice()) : null,
    h('div', { class: 'panel' },
      h('label', { class: 'label', for: 'name' }, t('home.name')),
      nameInput,
    ),
    h('div', { class: 'panel' },
      h('p', { class: 'label' }, t('home.host')),
      createBtn,
    ),
    h('div', { class: 'panel' },
      h('label', { class: 'label', for: 'code' }, t('home.joinLabel')),
      joinForm,
    ),
    error,
  );
}

function roomCodePanel(state: PublicRoomState, compact: boolean): HTMLElement {
  const aria = t('lobby.roomCodeAria', { code: state.code.split('').join(' ') });
  if (compact) {
    return h('div', { class: 'panel panel--bar' },
      h('span', { class: 'label' }, t('lobby.roomCode')),
      h('span', { class: 'room-code room-code--small', 'aria-label': aria, lang: 'en' }, state.code),
      h('span', { class: 'tag tag--round' }, t('game.round', { n: state.round })),
    );
  }
  return h('div', { class: 'panel panel--code' },
    h('p', { class: 'label' }, t('lobby.roomCode')),
    h('p', { class: 'room-code', 'aria-label': aria, lang: 'en' }, state.code),
    h('p', { class: 'hint' }, t('lobby.shareHint')),
  );
}

function playersPanel(state: PublicRoomState, amHost: boolean): HTMLElement {
  const me = session?.playerId;
  const connected = state.players.filter((p) => p.connected).length;
  return h('div', { class: 'panel' },
    h('p', { class: 'label' }, t('lobby.players', { on: connected, all: state.players.length })),
    h('ul', { class: 'players' }, ...state.players.map((p) => playerRow(state, p, p.id === me, amHost))),
  );
}

function renderRoom(state: PublicRoomState): HTMLElement {
  const amHost = state.hostId === session?.playerId && state.roles !== null;
  return state.phase === 'game' ? renderGame(state, amHost) : renderLobby(state, amHost);
}

function renderLobby(state: PublicRoomState, amHost: boolean): HTMLElement {
  return h('section', { class: 'screen' },
    roomCodePanel(state, false),
    hostGraceNotice(state),
    playersPanel(state, amHost),
    lobbyErrorNotice(state.roles ?? state.rolesInPlay),
    ...(amHost
      ? [settingsPanel(state), hostRolesPanel(state), startBlock(state)]
      : [rolesInPlayPanel(state), h('p', { class: 'hint hint--center blink-slow' }, t('lobby.waiting'))]),
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => void leaveRoom() }, t('lobby.leave')),
  );
}

function renderGame(state: PublicRoomState, amHost: boolean): HTMLElement {
  const you = state.you;
  let main: HTMLElement;
  if (you?.status === 'playing' && you.role) main = roleCard(you.role, state.settings.revealSeconds);
  else if (you?.status === 'moderating') main = moderatorPanel(state);
  else main = waitingPanel();

  return h('section', { class: 'screen' },
    roomCodePanel(state, true),
    hostGraceNotice(state),
    ui.newRound
      ? h('button', {
          class: 'banner banner--info banner--button', type: 'button',
          onclick: () => { ui.newRound = false; render(); },
        }, t('game.newRound'))
      : null,
    lobbyErrorNotice(state.rolesInPlay),
    main,
    amHost ? hostControls() : null,
    gameRolesPanel(state),
    playersPanel(state, amHost),
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => void leaveRoom() }, t('lobby.leave')),
  );
}

function playerRow(state: PublicRoomState, p: PublicPlayer, isMe: boolean, amHost: boolean): HTMLElement {
  const waiting = state.phase === 'game' && !p.inRound && !(p.isHost && !state.settings.hostPlays);
  return h('li', { class: `player${p.connected ? '' : ' player--away'}` },
    h('span', { class: `dot${p.connected ? ' dot--on' : ''}`, 'aria-hidden': 'true' }),
    h('span', { class: 'player__name' }, p.name),
    p.isHost ? h('span', { class: 'tag tag--host' }, t('tag.host')) : null,
    isMe ? h('span', { class: 'tag' }, t('tag.you')) : null,
    !p.connected ? h('span', { class: 'tag tag--away' }, t('tag.away')) : null,
    waiting ? h('span', { class: 'tag tag--away' }, t('tag.waiting')) : null,
    amHost && !isMe
      ? confirmButton(`kick:${p.id}`, t('kick'), () => void act.kick(p.id),
          { cls: 'btn--small btn--danger', aria: t('kick.aria', { name: p.name }) })
      : null,
  );
}

function hostGraceNotice(state: PublicRoomState): HTMLElement | null {
  const until = state.hostGraceUntil;
  if (until === null) return null;
  const text = h('span');
  const update = () => {
    const secs = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    text.textContent = t('lobby.hostGrace', { s: secs });
  };
  update();
  graceTimer = window.setInterval(update, 1000);
  return h('p', { class: 'banner banner--warn', role: 'status' }, text);
}

render();
