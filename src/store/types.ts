import type {
  Group,
  GroupMembership,
  Match,
  MatchStatus,
  Player,
  RSVPStatus,
  ScoreResult,
  SelfReportType,
} from '../types/domain';

export type CreateMatchInput = {
  venue: string;
  startsAt: string;
  maxPlayers: number;
  groupId?: string;
  pricePerPerson?: number;
  iban?: string;
};

export type RemoteProfileRow = {
  id: string;
  display_name: string;
  photo_uri: string | null;
  position: Player['position'];
  preferred_foot: Player['preferredFoot'];
  iban: string | null;
};

export interface AuthSlice {
  remoteUserId: string | null;
  setRemoteUserId: (id: string | null) => void;
  getCurrentUserId: () => string;
}

export interface PlayersSlice {
  players: Player[];
  getPlayer: (id: string) => Player | undefined;
  syncPlayerFromRemoteProfile: (row: RemoteProfileRow) => void;
  updatePlayerProfile: (
    playerId: string,
    patch: Partial<Pick<Player, 'name' | 'photoUri' | 'position' | 'preferredFoot' | 'iban'>>,
  ) => void;
}

export interface MatchesSlice {
  matches: Match[];
  getMatch: (id: string) => Match | undefined;

  /** Oturum + Supabase maçları yeniden yükler. */
  hydrateRemoteMatches: () => Promise<void>;
  refreshRemoteMatch: (matchId: string) => Promise<void>;

  createMatch: (input: CreateMatchInput) => Promise<Match>;
  joinMatchByJoinCode: (code: string) => Promise<Match | null>;

  setRSVP: (matchId: string, playerId: string, status: RSVPStatus) => Promise<void>;
  setPaid: (matchId: string, playerId: string, paid: boolean, actorId: string) => Promise<void>;

  setSelfReportEnabled: (matchId: string, enabled: boolean) => Promise<void>;
  addSelfReport: (matchId: string, playerId: string, type: SelfReportType) => Promise<void>;
  respondSelfReport: (matchId: string, requestId: string, approve: boolean) => Promise<void>;

  setMatchTeams: (matchId: string, teamAIds: string[], teamBIds: string[]) => Promise<void>;
  lockLineup: (matchId: string) => Promise<void>;

  submitScore: (matchId: string, result: ScoreResult) => Promise<void>;
  setMatchStatus: (matchId: string, status: MatchStatus) => Promise<void>;
}

export interface GroupsSlice {
  groups: Group[];
  groupMemberships: GroupMembership[];

  hydrateRemoteGroups: () => Promise<void>;

  createGroup: (name: string) => Promise<Group>;
  joinGroup: (joinCode: string) => Promise<Group | null>;
  leaveGroup: (groupId: string) => Promise<void>;
}

export type AppState = AuthSlice &
  PlayersSlice &
  MatchesSlice &
  GroupsSlice & {
    resetToSeed: () => void;
  };
