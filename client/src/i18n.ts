// UI strings in English and Azerbaijani. `az` must define every key in `en` (enforced by the type).
import type { CloseReason, ErrorCode, MessageParams, WarningCode } from '../../shared/errors';
import { defaultRoles } from '../../shared/roles';
import type { RoleInfo, TeamTag } from '../../shared/types';

export type Lang = 'en' | 'az';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'az', label: 'AZ' },
];

const en = {
  'app.connecting': 'Connecting…',
  'app.offline': 'Connection lost. Reconnecting…',
  'lang.label': 'Language',

  'home.name': 'Name',
  'home.namePlaceholder': 'Your name',
  'home.host': 'Host a game',
  'home.create': 'Create room',
  'home.joinLabel': 'Join with code',
  'home.join': 'Join',
  'home.needName': 'Enter a name first.',

  'lobby.roomCode': 'Room code',
  'lobby.roomCodeAria': 'Room code {code}',
  'lobby.shareHint': 'Friends join with this code',
  'lobby.players': 'Players {on}/{all}',
  'lobby.hostGrace': 'Host disconnected. Passing host on in {s}s…',
  'lobby.waiting': 'Waiting for the host to start…',
  'lobby.leave': 'Leave room',
  'lobby.kicked': 'The host removed you from the room.',

  'tag.host': 'Host',
  'tag.you': 'You',
  'tag.away': 'Away',
  'tag.waiting': 'Next round',
  'kick': 'Kick',
  'confirm': 'Sure?',
  'kick.aria': 'Kick {name}',
  'on': 'ON',
  'off': 'OFF',

  'settings.title': 'Settings',
  'settings.hostPlays': 'Host plays',
  'settings.hostPlaysOn': 'You get a role too.',
  'settings.hostPlaysOff': 'You moderate and get no role.',
  'settings.modSees': 'Moderator sees roles',
  'settings.modSeesHint': 'While you moderate, you can see who has which role.',
  'settings.reveal': 'Card auto-hide',
  'settings.revealHint': 'Seconds a revealed card stays up.',
  'settings.revealValue': '{s}s',
  'settings.revealAria': 'reveal seconds',

  'roles.title': 'Roles',
  'roles.auto': 'Auto',
  'roles.autoHint': 'Roles rescale as players join',
  'roles.usePreset': 'Use preset',
  'roles.summary': 'In game: {n} · Roles: {roles} · Villagers: {v}',
  'roles.required': 'Required',
  'roles.custom': 'Custom',
  'roles.edit': 'Edit',
  'roles.editAria': 'Edit {name}',
  'roles.delete': 'Delete',
  'roles.deleteAria': 'Delete {name}',
  'roles.villagerAuto': 'auto {n}',
  'roles.none': 'OFF',
  'roles.countAria': '{name} count',
  'stepper.dec': 'Decrease {label}',
  'stepper.inc': 'Increase {label}',
  'roles.namePlaceholder': 'Role name',
  'roles.descPlaceholder': 'What this role does (optional)',
  'roles.team': 'Team',
  'roles.cancel': 'Cancel',
  'roles.save': 'Save',
  'roles.add': 'Add',
  'roles.addCustom': '+ Add custom role',
  'roles.new': 'New role',
  'roles.limit': 'Role limit reached ({max}).',
  'roles.inPlay': 'Roles in play',
  'roles.inPlayHostPlays': '{n} players get a role. Host plays too.',
  'roles.inPlayMod': '{n} players get a role. {host} moderates.',
  'roles.notSet': 'The host has not set up roles yet.',

  'team.mafia': 'Mafia',
  'team.town': 'Town',
  'team.neutral': 'Neutral',

  'role.mafia.name': 'Mafia',
  'role.mafia.desc': 'Knows the other Mafia. Eliminate the town without getting caught.',
  'role.villager.name': 'Villager',
  'role.villager.desc': 'No special power. Find the Mafia and vote them out.',
  'role.sheriff.name': 'Sheriff',
  'role.sheriff.desc': 'Each night, check one player to learn if they are good or bad (not their exact role). If the Police dies, you can also shoot.',
  'role.doctor.name': 'Doctor',
  'role.doctor.desc': 'Each night, choose one player to protect from elimination.',
  'role.maniac.name': 'Maniac',
  'role.maniac.desc': 'Plays alone. Eliminate everyone else to win.',
  'role.kamikaze.name': 'Kamikaze',
  'role.kamikaze.desc': 'If eliminated, takes one player down with them.',
  'role.police.name': 'Police',
  'role.police.desc': 'Each round, you may shoot one player. If the Sheriff dies, you can also check if a player is good or bad.',

  'game.start': 'Start game',
  'game.fixFirst': 'Fix the issues above to start.',
  'game.round': 'Round {n}',
  'game.yourRole': 'Your role',
  'game.tapReveal': 'Tap to reveal',
  'game.tapHide': 'Tap to hide',
  'game.hidesIn': 'Hides in {s}s',
  'game.keepSecret': 'Keep your screen to yourself.',
  'game.moderating': 'You are moderating',
  'game.moderatingHint': 'You have no role this round.',
  'game.waitingNext': 'A game is in progress. You will get a role next round.',
  'game.hostControls': 'Host controls',
  'game.reshuffle': 'Reshuffle',
  'game.reshuffleHint': 'Deal new roles to everyone, including late joiners.',
  'game.end': 'End game',
  'game.newRound': 'New round! Check your role.',
  'game.allRoles': 'Who has what',
  'game.showAll': 'Show all roles',
  'game.hideAll': 'Hide all roles',
  'game.allRolesHint': 'Only you can see this. Hidden again when you leave the screen.',
  'game.cardAria': 'Your role card. {state}',

  'err.nameEmpty': 'Enter a name.',
  'err.codeInvalid': 'Room codes are 4 letters.',
  'err.roomNotFound': 'No room with that code.',
  'err.nameTaken': 'That name is taken in this room.',
  'err.roomFull': 'This room is full.',
  'err.roomGone': 'That room no longer exists.',
  'err.seatGone': 'Your seat in that room is gone.',
  'err.notInRoom': 'You are not in a room.',
  'err.notHost': 'Only the host can do that.',
  'err.kickSelf': 'You cannot kick yourself.',
  'err.playerNotFound': 'That player is not in the room.',
  'err.nothingToChange': 'Nothing to change.',
  'err.invalidValue': 'Invalid value.',
  'err.gameRunning': 'Not possible while a game is running.',
  'err.gameNotRunning': 'No game is running.',
  'err.roleNotFound': 'That role does not exist.',
  'err.roleNameEmpty': 'Give the role a name.',
  'err.roleNameTaken': 'A role with that name already exists.',
  'err.unknownTeam': 'Unknown team.',
  'err.roleTeamLocked': '{role} must stay on its team.',
  'err.roleRequired': '{role} is required and cannot be turned off.',
  'err.villagerAuto': 'Villagers fill the remaining seats automatically.',
  'err.mafiaMin': 'There must be at least one Mafia.',
  'err.tooManyRoleDefs': 'A room can have at most {max} roles.',
  'err.cannotDeleteDefault': 'Default roles can be turned off but not deleted.',
  'err.notEnoughPlayers': 'Need at least {min} players in the game (now {n}).',
  'err.noMafia': 'Need at least one Mafia.',
  'err.tooManyRoles': 'Too many roles: {roles} roles for {n} players.',
  'err.rateLimited': 'Too many attempts. Wait a minute and try again.',
  'err.serverBusy': 'The server is full right now. Try again later.',
  'err.noResponse': 'The server did not respond.',

  'warn.mafiaHeavy': 'Mafia are half the table or more. Town will struggle.',

  'close.idle': 'The room closed after being idle.',
  'close.empty': 'Everyone left the room.',
  'close.hostLeft': 'The host left.',
  'close.hostGone': 'The host left and nobody else is connected.',
  'close.otherTab': 'You opened this room in another tab.',
};

export type Key = keyof typeof en;

const az: Record<Key, string> = {
  'app.connecting': 'Qoşulur…',
  'app.offline': 'Bağlantı kəsildi. Yenidən qoşulur…',
  'lang.label': 'Dil',

  'home.name': 'Ad',
  'home.namePlaceholder': 'Adın',
  'home.host': 'Oyun yarat',
  'home.create': 'Otaq yarat',
  'home.joinLabel': 'Kodla qoşul',
  'home.join': 'Qoşul',
  'home.needName': 'Əvvəlcə adını yaz.',

  'lobby.roomCode': 'Otaq kodu',
  'lobby.roomCodeAria': 'Otaq kodu {code}',
  'lobby.shareHint': 'Dostların bu kodla qoşulur',
  'lobby.players': 'Oyunçular {on}/{all}',
  'lobby.hostGrace': 'Aparıcının bağlantısı kəsildi. {s} saniyəyə aparıcı dəyişəcək…',
  'lobby.waiting': 'Aparıcının oyunu başlatması gözlənilir…',
  'lobby.leave': 'Otaqdan çıx',
  'lobby.kicked': 'Aparıcı səni otaqdan çıxardı.',

  'tag.host': 'Aparıcı',
  'tag.you': 'Sən',
  'tag.away': 'Oflayn',
  'tag.waiting': 'Növbəti raund',
  'kick': 'Çıxart',
  'confirm': 'Əminsən?',
  'kick.aria': '{name} adlı oyunçunu çıxart',
  'on': 'AÇIQ',
  'off': 'BAĞLI',

  'settings.title': 'Ayarlar',
  'settings.hostPlays': 'Aparıcı da oynayır',
  'settings.hostPlaysOn': 'Sən də rol alırsan.',
  'settings.hostPlaysOff': 'Sən aparıcısan, rol almırsan.',
  'settings.modSees': 'Aparıcı rolları görür',
  'settings.modSeesHint': 'Aparıcı olanda kimin hansı rolda olduğunu görə bilərsən.',
  'settings.reveal': 'Kartın gizlənməsi',
  'settings.revealHint': 'Açılmış kart neçə saniyə görünür.',
  'settings.revealValue': '{s} san',
  'settings.revealAria': 'saniyə sayı',

  'roles.title': 'Rollar',
  'roles.auto': 'Avto',
  'roles.autoHint': 'Oyunçu qoşulduqca rollar avtomatik dəyişir',
  'roles.usePreset': 'Avtomatik et',
  'roles.summary': 'Oyunda: {n} · Rol: {roles} · Vətəndaş: {v}',
  'roles.required': 'Məcburi',
  'roles.custom': 'Xüsusi',
  'roles.edit': 'Dəyiş',
  'roles.editAria': '{name} rolunu dəyiş',
  'roles.delete': 'Sil',
  'roles.deleteAria': '{name} rolunu sil',
  'roles.villagerAuto': 'avto {n}',
  'roles.none': 'YOX',
  'roles.countAria': '{name} sayı',
  'stepper.dec': '{label}: azalt',
  'stepper.inc': '{label}: artır',
  'roles.namePlaceholder': 'Rolun adı',
  'roles.descPlaceholder': 'Bu rol nə edir (istəyə görə)',
  'roles.team': 'Komanda',
  'roles.cancel': 'Ləğv et',
  'roles.save': 'Yadda saxla',
  'roles.add': 'Əlavə et',
  'roles.addCustom': '+ Xüsusi rol əlavə et',
  'roles.new': 'Yeni rol',
  'roles.limit': 'Rol limiti dolub ({max}).',
  'roles.inPlay': 'Oyundakı rollar',
  'roles.inPlayHostPlays': '{n} oyunçu rol alır. Aparıcı da oynayır.',
  'roles.inPlayMod': '{n} oyunçu rol alır. {host} aparıcıdır.',
  'roles.notSet': 'Aparıcı hələ rolları seçməyib.',

  'team.mafia': 'Mafiya',
  'team.town': 'Şəhər',
  'team.neutral': 'Neytral',

  'role.mafia.name': 'Mafiya',
  'role.mafia.desc': 'Digər mafiyaları tanıyır. Yaxalanmadan şəhəri məhv et.',
  'role.villager.name': 'Vətəndaş',
  'role.villager.desc': 'Xüsusi gücü yoxdur. Mafiyanı tap və səsvermə ilə oyundan çıxart.',
  'role.sheriff.name': 'Şerif',
  'role.sheriff.desc': 'Hər gecə bir oyunçunu yoxla və onun yaxşı, yoxsa pis olduğunu öyrən (dəqiq rolunu yox). Polis ölsə, sən də atəş aça bilərsən.',
  'role.doctor.name': 'Həkim',
  'role.doctor.desc': 'Hər gecə bir oyunçunu seç və onu ölümdən qoru.',
  'role.maniac.name': 'Manyak',
  'role.maniac.desc': 'Tək oynayır. Qalib gəlmək üçün hamını məhv et.',
  'role.kamikaze.name': 'Kamikadze',
  'role.kamikaze.desc': 'Oyundan çıxarılsan, özünlə bir oyunçunu da aparırsan.',
  'role.police.name': 'Polis',
  'role.police.desc': 'Hər raund bir oyunçuya atəş aça bilərsən. Şerif ölsə, oyunçunun yaxşı, yoxsa pis olduğunu da yoxlaya bilərsən.',

  'game.start': 'Oyunu başlat',
  'game.fixFirst': 'Başlamaq üçün yuxarıdakı problemləri həll et.',
  'game.round': 'Raund {n}',
  'game.yourRole': 'Sənin rolun',
  'game.tapReveal': 'Açmaq üçün toxun',
  'game.tapHide': 'Gizlətmək üçün toxun',
  'game.hidesIn': '{s} saniyəyə gizlənir',
  'game.keepSecret': 'Ekranını heç kimə göstərmə.',
  'game.moderating': 'Sən aparıcısan',
  'game.moderatingHint': 'Bu raundda rolun yoxdur.',
  'game.waitingNext': 'Oyun gedir. Növbəti raundda rol alacaqsan.',
  'game.hostControls': 'Aparıcı idarəsi',
  'game.reshuffle': 'Yenidən payla',
  'game.reshuffleHint': 'Hamıya, gec qoşulanlara da, yeni rollar paylanır.',
  'game.end': 'Oyunu bitir',
  'game.newRound': 'Yeni raund! Rolunu yoxla.',
  'game.allRoles': 'Kim hansı roldadır',
  'game.showAll': 'Bütün rolları göstər',
  'game.hideAll': 'Rolları gizlət',
  'game.allRolesHint': 'Bunu yalnız sən görürsən. Ekrandan çıxanda yenidən gizlənir.',
  'game.cardAria': 'Rol kartın. {state}',

  'err.nameEmpty': 'Ad yaz.',
  'err.codeInvalid': 'Otaq kodu 4 hərfdən ibarətdir.',
  'err.roomNotFound': 'Bu kodla otaq yoxdur.',
  'err.nameTaken': 'Bu ad otaqda artıq var.',
  'err.roomFull': 'Otaq doludur.',
  'err.roomGone': 'Bu otaq artıq mövcud deyil.',
  'err.seatGone': 'Otaqdakı yerin artıq yoxdur.',
  'err.notInRoom': 'Sən heç bir otaqda deyilsən.',
  'err.notHost': 'Bunu yalnız aparıcı edə bilər.',
  'err.kickSelf': 'Özünü çıxara bilməzsən.',
  'err.playerNotFound': 'Bu oyunçu otaqda deyil.',
  'err.nothingToChange': 'Dəyişiləcək heç nə yoxdur.',
  'err.invalidValue': 'Yanlış dəyər.',
  'err.gameRunning': 'Oyun gedərkən bu mümkün deyil.',
  'err.gameNotRunning': 'Hazırda oyun getmir.',
  'err.roleNotFound': 'Belə rol yoxdur.',
  'err.roleNameEmpty': 'Rola ad ver.',
  'err.roleNameTaken': 'Bu adda rol artıq var.',
  'err.unknownTeam': 'Naməlum komanda.',
  'err.roleTeamLocked': '{role} öz komandasında qalmalıdır.',
  'err.roleRequired': '{role} məcburidir, söndürmək olmaz.',
  'err.villagerAuto': 'Vətəndaşlar qalan yerləri avtomatik doldurur.',
  'err.mafiaMin': 'Ən azı bir Mafiya olmalıdır.',
  'err.tooManyRoleDefs': 'Otaqda ən çox {max} rol ola bilər.',
  'err.cannotDeleteDefault': 'Standart rolları söndürmək olar, silmək olmaz.',
  'err.notEnoughPlayers': 'Oyunda ən azı {min} oyunçu lazımdır (indi {n}).',
  'err.noMafia': 'Ən azı bir Mafiya lazımdır.',
  'err.tooManyRoles': 'Rol çoxdur: {n} oyunçu üçün {roles} rol.',
  'err.rateLimited': 'Çox cəhd edildi. Bir dəqiqə gözlə və yenidən yoxla.',
  'err.serverBusy': 'Server hazırda doludur. Bir az sonra yenidən yoxla.',
  'err.noResponse': 'Server cavab vermədi.',

  'warn.mafiaHeavy': 'Mafiya oyunçuların yarısı və ya daha çoxudur. Şəhərə çətin olacaq.',

  'close.idle': 'Otaq uzun müddət boş qaldığı üçün bağlandı.',
  'close.empty': 'Hamı otaqdan çıxdı.',
  'close.hostLeft': 'Aparıcı çıxdı.',
  'close.hostGone': 'Aparıcı çıxdı, başqa qoşulan yoxdur.',
  'close.otherTab': 'Bu otağı başqa vərəqdə açdın.',
};

const DICTS: Record<Lang, Record<Key, string>> = { en, az };
const LANG_KEY = 'mafia.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'az') return saved;
  } catch { /* storage blocked */ }
  return navigator.language?.toLowerCase().startsWith('az') ? 'az' : 'en';
}

let lang: Lang = initialLang();
document.documentElement.lang = lang; // so CSS uppercase gives İ for i in Azerbaijani

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
}

export function t(key: Key, params?: MessageParams): string {
  const template = DICTS[lang][key] ?? en[key];
  if (!params) return template;
  const values = params;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? String(values[name]) : m));
}

// ---------- roles ----------

const DEFAULTS = new Map(defaultRoles().map((r) => [r.id, r]));

/** Default roles show in the current language until the host renames them. */
export function roleName(r: Pick<RoleInfo, 'id' | 'name'>): string {
  const d = DEFAULTS.get(r.id);
  return d && d.name === r.name ? t(`role.${r.id}.name` as Key) : r.name;
}

export function roleDesc(r: Pick<RoleInfo, 'id' | 'description'>): string {
  const d = DEFAULTS.get(r.id);
  return d && d.description === r.description ? t(`role.${r.id}.desc` as Key) : r.description;
}

export function teamName(team: TeamTag): string {
  return t(`team.${team}` as Key);
}

// ---------- server codes ----------

/** Translate an error code. A `role` param holding a role id is shown as that role's display name. */
export function errorText(code: ErrorCode, params?: MessageParams, roles?: RoleInfo[] | null): string {
  const roleId = params?.role;
  if (params && typeof roleId === 'string') {
    const r = roles?.find((x) => x.id === roleId) ?? DEFAULTS.get(roleId);
    if (r) params = { ...params, role: roleName(r) };
  }
  return t(`err.${code}` as Key, params);
}

export function warningText(code: WarningCode): string {
  return t(`warn.${code}` as Key);
}

export function closeText(reason: CloseReason): string {
  return t(`close.${reason}` as Key);
}
