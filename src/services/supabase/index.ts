export { fetchPlayerLeaderboardStats, type LeaderboardTimeframe } from './leaderboard';
export {
  fetchMatchById,
  fetchMatchesForCurrentUser,
  getMatchByJoinCodePreview,
  insertMatchWithOrganizerAttendee,
  joinMatchByJoinCode,
  submitMatchResultRpc,
  type CreateMatchRowInput,
} from './matches';
export {
  AppError,
  createAuthRequiredError,
  createNotFoundError,
  formatTechnicalErrorSummary,
  generateTraceId,
  isAppError,
  mapSupabaseError,
  shouldRetry,
  toUserMessage,
  type MapSupabaseErrorOptions,
} from './errors';
export { fetchMatchGraph, fetchMyMatchesGraph, type MatchGraphPayload } from './matchGraph';
export {
  getMatchGraphRpcHealthSnapshot,
  MATCH_GRAPH_ALERT_MIN_TOTAL_SAMPLES,
  MATCH_GRAPH_DETAIL_FALLBACK_RATIO_ALERT,
  MATCH_GRAPH_LIST_FALLBACK_RATIO_ALERT,
  type MatchGraphRpcHealthSnapshot,
} from './matchGraphRpcMonitoring';
export { fetchGroupWeeklySeries, upsertGroupWeeklySeriesRemote, type UpsertGroupWeeklySeriesInput } from './groupWeeklySeries';
export {
  jsonArrayOrEmpty,
  mapGroup,
  mapGroupWeeklySeries,
  mapLeaderboardRow,
  mapMembership,
  mapSelfReportStatus,
  mapSelfReportType,
  numOrUndef,
  rsvpFromDb,
  rsvpToDb,
  rowsToMatch,
  scoreResultToRpcPayload,
} from './mappers';
export {
  insertSelfReportRemote,
  replaceMatchTeamPlayersRemote,
  updateMatchAttendeeRemote,
  updateMatchOrganizerFieldsRemote,
  updateSelfReportStatusRemote,
} from './matchMutations';
export {
  fetchCurrentUserProfile,
  fetchProfileById,
  fetchProfilesByIds,
  updateCurrentUserProfile,
  type ProfileUpdate,
} from './profiles';
export {
  fetchMyPlayerBadgeInputs,
  mapRpcToPlayerBadgeInputs,
  type PlayerBadgeInputsRpcRow,
} from './playerBadges';
export type {
  GroupWeeklySeriesRow,
  MatchAttendeeRow,
  MatchRow,
  MatchStatLineRow,
  MatchTeamPlayerRow,
  PlayerLeaderboardStatsRow,
  ProfileRow,
  SelfReportRequestRow,
  StatLinePayload,
} from './types';
