export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PreferredFoot = 'left' | 'right' | 'both';

export type RSVPStatus = 'going' | 'maybe' | 'notGoing';

export type MatchStatus = 'upcoming' | 'ongoing' | 'finished' | 'cancelled';
export type GroupRole = 'owner' | 'member';
export type MatchPaymentMethod = 'note_only' | 'iban' | 'cash';

export interface PlayerStats {
  matchesPlayed: number;
  goals: number;
  assists: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface Player {
  id: string;
  name: string;
  photoUri?: string;
  /** Compact uppercase TR IBAN, no spaces */
  iban?: string;
  position: Position;
  preferredFoot: PreferredFoot;
  stats: PlayerStats;
}

export interface Attendee {
  playerId: string;
  status: RSVPStatus;
  paid: boolean;
}

export interface StatLine {
  playerId: string;
  count: number;
}

export interface ScoreResult {
  scoreA: number;
  scoreB: number;
  scorers: StatLine[];
  assists: StatLine[];
}

export type SelfReportType = 'goal' | 'assist';

export type SelfReportApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface SelfReportRequest {
  id: string;
  matchId: string;
  playerId: string;
  type: SelfReportType;
  status: SelfReportApprovalStatus;
}

/** Haftalık sabit gün/saat şablonu (Supabase `group_weekly_series`). */
export interface GroupWeeklySeries {
  id: string;
  groupId: string;
  isActive: boolean;
  /** 1 = Pazartesi … 7 = Pazar (ISO dow). */
  weekdayIsodow: number;
  /** `HH:mm:ss` (yerel). */
  localTime: string;
  timezone: string;
  venue: string;
  maxPlayers: number;
  pricePerPerson?: number;
  iban?: string;
  defaultOrganizerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  id: string;
  groupId?: string;
  /** Üretildiği haftalık seri (varsa). */
  seriesId?: string;
  /** Bu maç hangi bitmiş maçtan otomatik üretildiyse. */
  spawnedFromMatchId?: string;
  startsAt: string;
  venue: string;
  organizerId: string;
  maxPlayers: number;
  pricePerPerson?: number;
  iban?: string;
  ibanAccountName?: string;
  paymentNote?: string;
  paymentMethod: MatchPaymentMethod;
  joinCode: string;
  attendees: Attendee[];
  teamAIds: string[];
  teamBIds: string[];
  lineupLocked: boolean;
  selfReportEnabled: boolean;
  status: MatchStatus;
  result?: ScoreResult;
  selfReports: SelfReportRequest[];
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  createdAt: string;
}

export interface GroupMembership {
  groupId: string;
  playerId: string;
  role: GroupRole;
  createdAt: string;
}
