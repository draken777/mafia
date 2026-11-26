// Error and close-reason codes. The server sends codes; each client translates them into its own language.

export type ErrorCode =
  // rooms and seats
  | 'nameEmpty' | 'codeInvalid' | 'roomNotFound' | 'nameTaken' | 'roomFull' | 'roomGone' | 'seatGone'
  | 'notInRoom' | 'notHost' | 'kickSelf' | 'playerNotFound'
  // edits
  | 'nothingToChange' | 'invalidValue' | 'gameRunning' | 'gameNotRunning'
  | 'roleNotFound' | 'roleNameEmpty' | 'roleNameTaken' | 'unknownTeam' | 'roleTeamLocked' | 'roleRequired'
  | 'villagerAuto' | 'mafiaMin' | 'tooManyRoleDefs' | 'cannotDeleteDefault'
  // role setup validation (also used to block starting)
  | 'notEnoughPlayers' | 'noMafia' | 'tooManyRoles'
  // abuse limits
  | 'rateLimited' | 'serverBusy'
  // client side
  | 'noResponse';

export type WarningCode = 'mafiaHeavy';

export type MessageParams = Record<string, string | number>;

export interface Problem<C extends string = ErrorCode> {
  code: C;
  params?: MessageParams;
}

export type CloseReason = 'idle' | 'empty' | 'hostLeft' | 'hostGone' | 'otherTab';
