export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PreferredFoot = 'left' | 'right' | 'both';

export type RSVPStatus = 'going' | 'maybe' | 'notGoing';

export type MatchStatus = 'upcoming' | 'ongoing' | 'finished' | 'cancelled';
export type GroupRole = 'owner' | 'admin' | 'member';
export type MatchPaymentMethod = 'note_only' | 'iban' | 'cash';

export interface PlayerStats {
  matchesPlayed: number;
  goals: number;
  assists: number;
  wins: number;
  losses: number;
  draws: number;
  ratingAverage100?: number;
  ratingVoteCount?: number;
  motmCount?: number;
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
  /** Rakip takım lehine sayılan kendi kale golleri (gol krallığına dahil değil). */
  ownGoals: StatLine[];
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

/** Kullanıcının maç oluşturma ekranında kaydettiği yerel şablon (AsyncStorage). Grup haftalık serisinden bağımsızdır. */
export const MATCH_TEMPLATE_NAME_MAX_LEN = 40;

export interface MatchTemplateSchedule {
  /** 1 = Pazartesi … 7 = Pazar (ISO), `GroupWeeklySeries` ile aynı. */
  weekdayIsodow: number;
  /** `HH:mm` veya `HH:mm:ss` (yerel). */
  localTime: string;
}

export interface MatchTemplate {
  id: string;
  name: string;
  venue: string;
  maxPlayers: number;
  groupId?: string;
  /** Yoksa şablon uygulanırken mevcut tarih/saat korunur. */
  schedule?: MatchTemplateSchedule;
  paymentMethod: MatchPaymentMethod;
  pricePerPerson?: number;
  iban?: string;
  ibanAccountName?: string;
  paymentNote?: string;
  /** `paymentMethod === 'iban'` iken true: formda profil IBAN’ı (override kapalı). */
  ibanUsesProfile?: boolean;
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
  /** Kadro şablonu kimliği (`src/data/lineupFormations.ts`). Uzak DB ile senkronize edilmez; yenilemede yerelden korunur. */
  lineupFormationId?: string | null;
  lineupLocked: boolean;
  selfReportEnabled: boolean;
  status: MatchStatus;
  result?: ScoreResult;
  selfReports: SelfReportRequest[];
  /** ISO timestamp: puanlama penceresinin kapanış zamanı. submit_match_result tarafından doldurulur. */
  ratingWindowEndsAt?: string;
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
