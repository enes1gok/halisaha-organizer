import type { UpsertGroupWeeklySeriesInput } from '../services/supabase/groupWeeklySeries';
import type {
  MatchRatingPublicSummaryDb,
  PeerRatingInput,
} from '../services/supabase/matchRatings';
import type { MatchGoalEntry } from '../types/domain';
import type {
  Group,
  GroupMembership,
  GroupWeeklySeries,
  Match,
  MatchPaymentMethod,
  MatchScoreVoteTally,
  MatchStatus,
  MatchTemplate,
  Player,
  Position,
  RSVPStatus,
  ScoreResult,
  SelfReportType,
} from '../types/domain';
import type { RemoteHydrateOpts } from '../types/remoteHydration';
import type { MatchGraphPageCursor } from '../services/supabase/matchGraph';

export type { MatchRatingPublicSummaryDb, PeerRatingInput };
export type { MatchScoreVoteTally };

export type CreateMatchInput = {
  venue: string;
  startsAt: string;
  maxPlayers: number;
  groupId?: string;
  pricePerPerson?: number;
  iban?: string;
  ibanAccountName?: string;
  paymentNote?: string;
  paymentMethod: 'note_only' | 'iban' | 'cash';
};

export type EditMatchInput = {
  matchId: string;
  venue: string;
  startsAt: string;
  maxPlayers: number;
  pricePerPerson?: number;
  iban?: string;
  ibanAccountName?: string;
  paymentNote?: string;
  paymentMethod: MatchPaymentMethod;
};

export type RemoteProfileRow = {
  id: string;
  display_name: string;
  photo_uri: string | null;
  position: Player['position'];
  preferred_foot: Player['preferredFoot'];
  iban: string | null;
  /** 1–10 kullanıcı beyan yetenek seviyesi; NULL = belirtilmemiş. */
  skill_level?: number | null;
  /** İstemci `photo_uri` önbellek bust için (Supabase `profiles.updated_at`). */
  updated_at?: string;
};

export interface AuthSlice {
  remoteUserId: string | null;
  setRemoteUserId: (id: string | null) => void;
  getCurrentUserId: () => string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface PreferencesSlice {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

export interface MatchTemplatesSlice {
  matchTemplates: MatchTemplate[];
  addMatchTemplate: (template: Omit<MatchTemplate, 'id'> & { id?: string }) => string;
  updateMatchTemplate: (id: string, patch: Partial<Omit<MatchTemplate, 'id'>>) => void;
  removeMatchTemplate: (id: string) => void;
  reorderMatchTemplates: (idsInOrder: string[]) => void;
}

export interface PlayersSlice {
  players: Player[];
  getPlayer: (id: string) => Player | undefined;
  syncPlayerFromRemoteProfile: (row: RemoteProfileRow) => void;
  updatePlayerProfile: (
    playerId: string,
    patch: Partial<Pick<Player, 'name' | 'photoUri' | 'position' | 'preferredFoot' | 'iban' | 'skillLevel'>>,
  ) => void;
}

export interface MatchesSlice {
  matches: Match[];
  getMatch: (id: string) => Match | undefined;

  /** Uzak maç derecelendirme özeti (persist dışı; sayfa yeniden açılınca tekrar yüklenir). */
  matchRatingSummariesById: Record<string, MatchRatingPublicSummaryDb | undefined>;
  /** Bitmiş uzak maç için `get_match_rating_public_summary`. */
  loadMatchRatingSummary: (matchId: string) => Promise<void>;
  /** Kadro uygun kullanıcı: puanlar + MOTM. */
  submitMatchRatings: (matchId: string, scores: PeerRatingInput[], motmPickId: string) => Promise<void>;
  /** Sadece organizatör: derecelendirme penceresini manuel kapatır. */
  closeMatchRating: (matchId: string) => Promise<void>;

  /** Maç Ratings gönderildi (persist dışı; Maçlarım özeti yönlendirmesi için). */
  matchRatingsSubmissionByMatchId: Record<string, true>;

  /** Persist dışı: liste satırı giriş animasyonu bekleyen maç id'leri. */
  matchIdsPendingListEntrance: string[];
  markMatchPendingListEntrance: (id: string) => void;
  clearMatchPendingListEntrance: (id: string) => void;

  /** Oturum + Supabase maçları yeniden yükler. */
  hydrateRemoteMatches: (opts?: RemoteHydrateOpts) => Promise<void>;
  /** Sayfalama: bir sonraki sayfayı mevcut listeye ekler. */
  loadMoreRemoteMatches: () => Promise<void>;
  /** Sonraki sayfa varsa true (persist dışı). */
  hasMoreRemoteMatches: boolean;
  /** Persist dışı: son sayfa cursor'u. */
  remoteMatchesCursor: MatchGraphPageCursor | null;
  refreshRemoteMatch: (matchId: string) => Promise<void>;

  createMatch: (input: CreateMatchInput) => Promise<Match>;
  updateMatchDetails: (input: EditMatchInput) => Promise<void>;
  joinMatchByJoinCode: (code: string) => Promise<Match | null>;

  setRSVP: (matchId: string, playerId: string, status: RSVPStatus) => Promise<void>;
  /** Dolu maçlara yedek olarak kaydol. Boş yer varsa no-op. */
  joinWaitlist: (matchId: string) => Promise<void>;
  setPaid: (matchId: string, playerId: string, paid: boolean, actorId: string) => Promise<void>;

  setSelfReportEnabled: (matchId: string, enabled: boolean) => Promise<void>;
  addSelfReport: (matchId: string, playerId: string, type: SelfReportType) => Promise<void>;
  respondSelfReport: (matchId: string, requestId: string, approve: boolean) => Promise<void>;

  setMatchTeams: (
    matchId: string,
    teamAIds: string[],
    teamBIds: string[],
    lineupFormationId?: string | null,
    lineupSlotsA?: (string | null)[] | null,
    lineupSlotsB?: (string | null)[] | null,
  ) => Promise<void>;
  lockLineup: (matchId: string) => Promise<void>;
  unlockLineup: (matchId: string) => Promise<void>;

  submitScore: (matchId: string, result: ScoreResult) => Promise<void>;
  /** Organizatör bitmiş maçta skoru/istatistikleri düzenler; rating penceresi sıfırlanmaz. */
  updateMatchResultOrganizer: (matchId: string, result: ScoreResult) => Promise<void>;
  setMatchStatus: (matchId: string, status: MatchStatus) => Promise<void>;
  /** Organizer cancels an upcoming match; backend trigger pushes 'match_cancelled' to going attendees. */
  cancelMatch: (matchId: string) => Promise<void>;

  /** Persist dışı: oyuncu başına ön gol girişleri (matchId → MatchGoalEntry[]). */
  goalEntriesByMatchId: Record<string, MatchGoalEntry[]>;
  /** Belirtilen maç için gol girişlerini Supabase'den yükler. */
  fetchGoalEntries: (matchId: string) => Promise<void>;
  /** Oturumdaki kullanıcının gol/asistini kaydeder. */
  saveGoalEntry: (matchId: string, goals: number, assists: number) => Promise<void>;

  /** Persist dışı: post-maç skor önerileri tally (matchId → tally listesi, ağırlığa göre sıralı). */
  scoreVoteTalliesByMatchId: Record<string, MatchScoreVoteTally[] | undefined>;
  /** Skor tallysini yükler. Uzak olmayan maçlar için no-op. */
  fetchScoreVoteTally: (matchId: string) => Promise<void>;
  /** Skor önerisi gönderir ve tally'yi günceller. */
  submitMatchScoreVote: (matchId: string, scoreA: number, scoreB: number) => Promise<void>;

  /** Misafir oyuncu ekler (uygulamayı yüklememiş kişi). Organizatör yetkisi gerektirir. */
  addGuestAttendee: (matchId: string, displayName: string, position: Position) => Promise<void>;
  /** Misafir oyuncuyu maçtan kaldırır. */
  removeGuestAttendee: (matchId: string, guestId: string) => Promise<void>;
  /** Misafirin ödeme durumunu günceller. */
  setGuestPaid: (matchId: string, guestId: string, paid: boolean) => Promise<void>;
}

export type CreateGroupResult = {
  group: Group;
  /** Liste yenileme başarısız oldu; grup uzakta oluşturulmuş olabilir. */
  hydrateFailed: boolean;
};

export interface GroupsSlice {
  groups: Group[];
  groupMemberships: GroupMembership[];
  /** Uzak `group_weekly_series` önbelleği (persist dışı). */
  weeklySeriesByGroupId: Record<string, GroupWeeklySeries | null | undefined>;

  hydrateRemoteGroups: (opts?: RemoteHydrateOpts) => Promise<void>;

  createGroup: (name: string) => Promise<CreateGroupResult>;
  joinGroup: (joinCode: string) => Promise<Group | null>;
  leaveGroup: (groupId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;

  fetchGroupWeeklySeries: (groupId: string) => Promise<void>;
  upsertGroupWeeklySeries: (input: UpsertGroupWeeklySeriesInput) => Promise<void>;

  kickGroupMember: (groupId: string, targetPlayerId: string) => Promise<void>;
  setGroupMemberRole: (groupId: string, targetPlayerId: string, role: 'admin' | 'member') => Promise<void>;

  updateGroupPhoto: (groupId: string, localUri: string) => Promise<void>;
}

export type AppState = AuthSlice &
  PlayersSlice &
  MatchesSlice &
  GroupsSlice &
  PreferencesSlice &
  MatchTemplatesSlice & {
    resetToSeed: () => void;
  };
