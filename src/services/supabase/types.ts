/** DB snake_case row shapes (public schema). Map to domain types at UI/store boundaries. */

export type PlayerPositionRow = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PreferredFootRow = 'left' | 'right' | 'both';

export type RsvpStatusRow = 'going' | 'maybe' | 'not_going' | 'waitlisted';

export type MatchStatusRow = 'upcoming' | 'ongoing' | 'finished' | 'cancelled';
export type MatchPaymentMethodRow = 'note_only' | 'iban' | 'cash';

export type TeamSideRow = 'A' | 'B';

export type StatLineKindRow = 'goal' | 'assist' | 'own_goal';

export type SelfReportTypeRow = 'goal' | 'assist';

export type SelfReportStatusRow = 'pending' | 'approved' | 'rejected';

export interface ProfileRow {
  id: string;
  display_name: string;
  photo_uri: string | null;
  position: PlayerPositionRow;
  preferred_foot: PreferredFootRow;
  iban: string | null;
  /** 1–10 kullanıcı beyan yetenek seviyesi; NULL = belirtilmemiş. */
  skill_level: number | null;
  /** JSON preferences; use `normalizeNotificationPreferences` at UI boundary. */
  notification_preferences?: unknown;
  weekly_match_streak_weeks?: number;
  weekly_match_last_qualifying_week_start?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicProfileRow {
  id: string;
  display_name: string;
  photo_uri: string | null;
  position: PlayerPositionRow;
  preferred_foot: PreferredFootRow;
  /** 1–10 kullanıcı beyan yetenek seviyesi; NULL = belirtilmemiş. */
  skill_level?: number | null;
  /** Avatar/cache busting için; roster görünümlerinde istemci `photo_uri` ile birleştirir. */
  updated_at?: string;
  weekly_match_streak_weeks?: number;
  weekly_match_last_qualifying_week_start?: string | null;
  weekly_match_streak_effective_weeks?: number;
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
  iban_account_name: string | null;
  payment_note: string | null;
  payment_method: MatchPaymentMethodRow;
  join_code: string;
  lineup_locked: boolean;
  /** Taktik şablon kimliği; klasik modda null. */
  lineup_formation_id?: string | null;
  self_report_enabled: boolean;
  status: MatchStatusRow;
  score_a: number | null;
  score_b: number | null;
  /** Omitted by match graph RPCs (payload trim); present on table-backed rows. */
  created_at?: string;
  /** Omitted by match graph RPCs (payload trim); present on table-backed rows. */
  updated_at?: string;
  rating_window_ends_at?: string | null;
}

export interface GroupRow {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  created_at: string;
  photo_uri: string | null;
}

export interface GroupMemberRow {
  group_id: string;
  player_id: string;
  role: 'owner' | 'admin' | 'member';
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
  waitlisted_at: string | null;
}

export interface MatchTeamPlayerRow {
  match_id: string;
  player_id: string;
  team: TeamSideRow;
  /** Taktik şablon slot indeksi (0-based); klasik modda veya henüz yerleştirilmemişse null. */
  slot_index?: number | null;
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
}

export interface MatchGuestAttendeeRow {
  id: string;
  match_id: string;
  display_name: string;
  position: PlayerPositionRow;
  paid: boolean;
  added_by: string;
  created_at: string;
}

export interface MatchGuestTeamAssignmentRow {
  match_id: string;
  guest_id: string;
  team: TeamSideRow;
  /** Taktik şablon slot indeksi (0-based); klasik modda veya henüz yerleştirilmemişse null. */
  slot_index?: number | null;
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
