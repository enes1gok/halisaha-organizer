/** DB snake_case row shapes (public schema). Map to domain types at UI/store boundaries. */

export type PlayerPositionRow = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PreferredFootRow = 'left' | 'right' | 'both';

export type RsvpStatusRow = 'going' | 'maybe' | 'not_going';

export type MatchStatusRow = 'upcoming' | 'ongoing' | 'finished' | 'cancelled';

export type TeamSideRow = 'A' | 'B';

export type StatLineKindRow = 'goal' | 'assist';

export type SelfReportTypeRow = 'goal' | 'assist';

export type SelfReportStatusRow = 'pending' | 'approved' | 'rejected';

export interface ProfileRow {
  id: string;
  display_name: string;
  photo_uri: string | null;
  position: PlayerPositionRow;
  preferred_foot: PreferredFootRow;
  iban: string | null;
  /** JSON preferences; use `normalizeNotificationPreferences` at UI boundary. */
  notification_preferences?: unknown;
  created_at: string;
  updated_at: string;
}

export interface PublicProfileRow {
  id: string;
  display_name: string;
  photo_uri: string | null;
  position: PlayerPositionRow;
  preferred_foot: PreferredFootRow;
}

export interface MatchRow {
  id: string;
  group_id: string | null;
  series_id: string | null;
  spawned_from_match_id: string | null;
  starts_at: string;
  venue: string;
  organizer_id: string;
  max_players: number;
  price_per_person: number | null;
  iban: string | null;
  join_code: string;
  lineup_locked: boolean;
  self_report_enabled: boolean;
  status: MatchStatusRow;
  score_a: number | null;
  score_b: number | null;
  created_at: string;
  updated_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  created_at: string;
}

export interface GroupMemberRow {
  group_id: string;
  player_id: string;
  role: 'owner' | 'member';
  created_at: string;
}

export interface GroupWeeklySeriesRow {
  id: string;
  group_id: string;
  is_active: boolean;
  weekday_isodow: number;
  local_time: string;
  timezone: string;
  venue: string;
  max_players: number;
  price_per_person: number | null;
  iban: string | null;
  default_organizer_id: string;
  created_at: string;
  updated_at: string;
}

export interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchAttendeeRow {
  match_id: string;
  player_id: string;
  status: RsvpStatusRow;
  paid: boolean;
}

export interface MatchTeamPlayerRow {
  match_id: string;
  player_id: string;
  team: TeamSideRow;
}

export interface MatchStatLineRow {
  match_id: string;
  player_id: string;
  kind: StatLineKindRow;
  count: number;
}

export interface SelfReportRequestRow {
  id: string;
  match_id: string;
  player_id: string;
  type: SelfReportTypeRow;
  status: SelfReportStatusRow;
  created_at: string;
}

export interface StatLinePayload {
  player_id: string;
  count?: number;
}

export interface PlayerLeaderboardStatsRow {
  player_id: string;
  goals: number;
  assists: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
}

export type LeaderboardMetricFilter = 'goals' | 'assists' | 'matches' | 'winRate' | null;
