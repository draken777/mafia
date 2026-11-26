// Lobby panels for roles and settings: the host's editor and everyone's read-only "Roles in play".
import { MAX_PLAYERS, MAX_ROLES, REVEAL_SECONDS_MAX, REVEAL_SECONDS_MIN, ROLE_DESC_MAX, ROLE_NAME_MAX } from '../../shared/limits';
import { MAFIA_ID, TEAMS, VILLAGER_ID, summarizeRoles } from '../../shared/roles';
import type { PublicRoomState, Role, RoleInfo, RolePatch, TeamTag } from '../../shared/types';
import * as act from './actions';
import { h } from './dom';
import { errorText, roleDesc, roleName, t, teamName, warningText } from './i18n';
import { roleIcon } from './pixel';
import { refresh, ui, type RoleDraft } from './ui';
import { stepper, teamTag } from './widgets';

// ---------- settings (host) ----------

function toggle(on: boolean, onClick: () => void): HTMLElement {
  return h('button', {
    class: `btn btn--small btn--toggle${on ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(on), onclick: onClick,
  }, on ? t('on') : t('off'));
}

export function settingsPanel(state: PublicRoomState): HTMLElement {
  const s = state.settings;
  const set = (patch: Partial<typeof s>) => {
    Object.assign(state.settings, patch); // optimistic; the server echo wins
    refresh();
    void act.updateSettings(patch);
  };
  return h('div', { class: 'panel' },
    h('p', { class: 'label' }, t('settings.title')),
    h('div', { class: 'setting' },
      h('div', {},
        h('p', { class: 'setting__name' }, t('settings.hostPlays')),
        h('p', { class: 'hint' }, s.hostPlays ? t('settings.hostPlaysOn') : t('settings.hostPlaysOff')),
      ),
      toggle(s.hostPlays, () => set({ hostPlays: !s.hostPlays })),
    ),
    !s.hostPlays
      ? h('div', { class: 'setting' },
          h('div', {},
            h('p', { class: 'setting__name' }, t('settings.modSees')),
            h('p', { class: 'hint' }, t('settings.modSeesHint')),
          ),
          toggle(s.moderatorSeesRoles, () => set({ moderatorSeesRoles: !s.moderatorSeesRoles })),
        )
      : null,
    h('div', { class: 'setting' },
      h('div', {},
        h('p', { class: 'setting__name' }, t('settings.reveal')),
        h('p', { class: 'hint' }, t('settings.revealHint')),
      ),
      stepper(t('settings.revealValue', { s: s.revealSeconds }), t('settings.revealAria'),
        s.revealSeconds > REVEAL_SECONDS_MIN ? () => set({ revealSeconds: s.revealSeconds - 1 }) : null,
        s.revealSeconds < REVEAL_SECONDS_MAX ? () => set({ revealSeconds: s.revealSeconds + 1 }) : null),
    ),
  );
}

// ---------- roles (host) ----------

export function hostRolesPanel(state: PublicRoomState): HTMLElement {
  const roles = state.roles ?? [];
  const summary = summarizeRoles(roles, state.playersInGame);
  const auto = state.rolesCustomized === false;

  return h('div', { class: 'panel' },
    h('div', { class: 'panel__head' },
      h('p', { class: 'label' }, t('roles.title')),
      auto
        ? h('span', { class: 'tag tag--auto', title: t('roles.autoHint') }, t('roles.auto'))
        : h('button', { class: 'btn btn--small', type: 'button', onclick: () => void act.usePreset() }, t('roles.usePreset')),
    ),
    h('p', { class: 'summary' }, t('roles.summary', { n: summary.players, roles: summary.special, v: summary.villagers })),
    ...summary.errors.map((e) => h('p', { class: 'notice notice--error' }, errorText(e.code, e.params, roles))),
    ...summary.warnings.map((w) => h('p', { class: 'notice' }, warningText(w.code))),
    h('ul', { class: 'roles' }, ...roles.map((r) => roleRow(r, summary.villagers))),
    addRoleBlock(roles.length),
  );
}

/** Start button for the host, disabled while the setup has errors. */
export function startBlock(state: PublicRoomState): HTMLElement {
  const blocked = summarizeRoles(state.roles ?? [], state.playersInGame).errors.length > 0;
  return h('div', { class: 'start' },
    h('button', {
      class: 'btn btn--primary btn--big', type: 'button', disabled: blocked,
      onclick: () => void act.startGame(),
    }, t('game.start')),
    blocked ? h('p', { class: 'hint hint--center' }, t('game.fixFirst')) : null,
  );
}

function roleRow(role: Role, villagers: number): HTMLElement {
  if (ui.editing?.id === role.id) return h('li', { class: 'role role--editing' }, roleEditor(role));

  const name = roleName(role);
  const active = role.id === VILLAGER_ID ? villagers > 0 : role.enabled && role.count > 0;
  const setCount = (n: number) => {
    role.count = n; // optimistic; the server echo wins
    if (!role.required) role.enabled = n > 0;
    refresh();
    void act.updateRole(role.id, { count: n });
  };

  let control: HTMLElement;
  if (role.id === VILLAGER_ID) {
    control = h('span', { class: 'role__auto' }, t('roles.villagerAuto', { n: villagers }));
  } else {
    const min = role.id === MAFIA_ID ? 1 : 0;
    control = stepper(role.count === 0 ? t('roles.none') : String(role.count), t('roles.countAria', { name }),
      role.count > min ? () => setCount(role.count - 1) : null,
      role.count < MAX_PLAYERS ? () => setCount(role.count + 1) : null);
  }

  const desc = roleDesc(role);
  return h('li', { class: `role role--${role.team}${active ? '' : ' role--off'}` },
    h('div', { class: 'role__top' },
      h('span', { class: 'role__icon' }, roleIcon(role.id, 2)),
      h('span', { class: 'role__name' }, name),
      teamTag(role.team),
      role.required ? h('span', { class: 'tag tag--req' }, t('roles.required')) : null,
      !role.isDefault ? h('span', { class: 'tag' }, t('roles.custom')) : null,
    ),
    desc ? h('p', { class: 'role__desc' }, desc) : null,
    h('div', { class: 'role__bottom' },
      h('button', {
        class: 'btn btn--small btn--ghost', type: 'button', 'aria-label': t('roles.editAria', { name }),
        onclick: () => {
          ui.editing = { id: role.id, name, description: desc, team: role.team };
          refresh();
        },
      }, t('roles.edit')),
      !role.isDefault
        ? h('button', {
            class: 'btn btn--small btn--ghost', type: 'button', 'aria-label': t('roles.deleteAria', { name }),
            onclick: () => void act.deleteRole(role.id),
          }, t('roles.delete'))
        : null,
      control,
    ),
  );
}

/** Name / description / team fields bound to a draft object that survives re-renders. */
function draftFields(draft: RoleDraft, keyPrefix: string, lockTeam: boolean): HTMLElement[] {
  const name = h('input', {
    class: 'input', maxlength: ROLE_NAME_MAX, value: draft.name, placeholder: t('roles.namePlaceholder'),
    'data-key': `${keyPrefix}-name`, 'aria-label': t('roles.namePlaceholder'),
  });
  name.addEventListener('input', () => (draft.name = name.value));

  const desc = h('textarea', {
    class: 'input input--area', maxlength: ROLE_DESC_MAX, rows: 3, placeholder: t('roles.descPlaceholder'),
    'data-key': `${keyPrefix}-desc`, 'aria-label': t('roles.descPlaceholder'),
  });
  desc.value = draft.description;
  desc.addEventListener('input', () => (draft.description = desc.value));

  const team = h('select', { class: 'input input--select', 'data-key': `${keyPrefix}-team`, 'aria-label': t('roles.team'), disabled: lockTeam },
    ...TEAMS.map((tm) => h('option', { value: tm, selected: tm === draft.team }, teamName(tm))));
  team.addEventListener('change', () => (draft.team = team.value as TeamTag));

  return [name, desc, h('label', { class: 'field-row' }, h('span', { class: 'hint' }, t('roles.team')), team)];
}

function roleEditor(role: Role): HTMLElement {
  const draft = ui.editing!;
  const save = async () => {
    // Only send what changed from what the host saw, so a default role keeps translating
    // in every language unless the host actually renamed it.
    const patch: RolePatch = {};
    if (draft.name.trim() !== roleName(role)) patch.name = draft.name;
    if (draft.description.trim() !== roleDesc(role)) patch.description = draft.description;
    if (!role.required && draft.team !== role.team) patch.team = draft.team;
    if (Object.keys(patch).length === 0 || (await act.updateRole(role.id, patch))) {
      ui.editing = null;
      refresh();
    }
  };
  const form = h('form', { class: 'role-form' },
    ...draftFields(draft, `edit-${role.id}`, role.required),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { ui.editing = null; refresh(); } }, t('roles.cancel')),
      h('button', { class: 'btn btn--primary', type: 'submit' }, t('roles.save')),
    ),
  );
  form.addEventListener('submit', (e) => { e.preventDefault(); void save(); });
  return form;
}

function addRoleBlock(roleCount: number): HTMLElement {
  if (roleCount >= MAX_ROLES) return h('p', { class: 'hint' }, t('roles.limit', { max: MAX_ROLES }));
  const draft = ui.adding;
  if (!draft) {
    return h('button', {
      class: 'btn btn--wide', type: 'button',
      onclick: () => { ui.adding = { name: '', description: '', team: 'town' }; refresh(); },
    }, t('roles.addCustom'));
  }
  const form = h('form', { class: 'role-form role-form--add' },
    h('p', { class: 'label' }, t('roles.new')),
    ...draftFields(draft, 'add', false),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { ui.adding = null; refresh(); } }, t('roles.cancel')),
      h('button', { class: 'btn btn--primary', type: 'submit' }, t('roles.add')),
    ),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await act.addRole({ ...draft })) {
      ui.adding = null;
      refresh();
    }
  });
  return form;
}

// ---------- everyone ----------

export function rolesInPlayPanel(state: PublicRoomState): HTMLElement {
  const host = state.players.find((p) => p.isHost);
  return h('div', { class: 'panel' },
    h('p', { class: 'label' }, t('roles.inPlay')),
    h('p', { class: 'summary' },
      state.settings.hostPlays
        ? t('roles.inPlayHostPlays', { n: state.playersInGame })
        : t('roles.inPlayMod', { n: state.playersInGame, host: host?.name ?? t('tag.host') })),
    state.rolesInPlay.length
      ? h('ul', { class: 'roles' }, ...state.rolesInPlay.map(infoRow))
      : h('p', { class: 'hint' }, t('roles.notSet')),
  );
}

export function infoRow(r: RoleInfo): HTMLElement {
  const desc = roleDesc(r);
  return h('li', { class: `role role--${r.team}` },
    h('div', { class: 'role__top' },
      h('span', { class: 'role__icon' }, roleIcon(r.id, 2)),
      h('span', { class: 'role__name' }, roleName(r)),
      teamTag(r.team),
    ),
    desc ? h('p', { class: 'role__desc' }, desc) : null,
  );
}
