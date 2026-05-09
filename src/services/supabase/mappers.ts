import type {
  Attendee,
  Group,
  GroupMembership,
  GroupWeeklySeries,
  Match,
  MatchStatus,
  RSVPStatus,
  ScoreResult,
  SelfReportApprovalStatus,
  SelfReportRequest,
  SelfReportType,
  StatLine,
} from '../../types/domain';
import type {
  GroupMemberRow,
  GroupRow,
  GroupWeeklySeriesRow,
  MatchAttendeeRow,
  MatchRow,
  MatchStatLineRow,
  MatchTeamPlayerRow,
  PlayerLeaderboardStatsRow,
  RsvpStatusRow,
  SelfReportRequestRow,
  SelfReportStatusRow,
  SelfReportTypeRow,
} from './types';

export function rsvpFromDb(row: RsvpStatusRow): RSVPStatus {
  if (row === 'not_going') return 'notGoing';
  return row;
}

export function rsvpToDb(status: RSVPStatus): RsvpStatusRow {
  if (status === 'notGoing') return 'not_going';
  return status;
}

/** Normalizes numeric DB values (number or numeric string at runtime). */
export function numOrUndef(n: number | string | null | undefined): number | undefined {
  if (n === null || n === undefined) return undefined;
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : undefined;
}

export function mapSelfReportStatus(s: SelfReportStatusRow): SelfReportApprovalStatus {
  return s;
}

export function mapSelfReportType(t: SelfReportTypeRow): SelfReportType {
  return t;
}

export function rowsToMatch(
  row: MatchRow,
  attendees: MatchAttendeeRow[],
  teamPlayers: MatchTeamPlayerRow[],
  statLines: MatchStatLineRow[],
  selfReports: SelfReportRequestRow[],
): Match {
  const teamAIds = teamPlayers.filter((t) => t.team === 'A').map((t) => t.player_id);
  const teamBIds = teamPlayers.filter((t) => t.team === 'B').map((t) => t.player_id);

  const domainAttendees: Attendee[] = attendees.map((a) => ({
    playerId: a.player_id,
    status: rsvpFromDb(a.status),
    paid: a.paid,
  }));

  let result: ScoreResult | undefined;
  // TODO: surface partial-score as bug — finished + null score currently yields result undefined
  if (row.status === 'finished' && row.score_a != null && row.score_b != null) {
    const scorers: StatLine[] = statLines
      .filter((l) => l.kind === 'goal')
      .map((l) => ({ playerId: l.player_id, count: l.count }));
    const assists: StatLine[] = statLines
      .filter((l) => l.kind === 'assist')
      .map((l) => ({ playerId: l.player_id, count: l.count }));
    result = {
      scoreA: row.score_a,
      scoreB: row.score_b,
      scorers,
      assists,
    };
  }

  const domainSelf: SelfReportRequest[] = selfReports.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    playerId: r.player_id,
    type: mapSelfReportType(r.type),
    status: mapSelfReportStatus(r.status),
  }));

  const price = numOrUndef(row.price_per_person);

  return {
    id: row.id,
    groupId: row.group_id ?? undefined,
    seriesId: row.series_id ?? undefined,
    spawnedFromMatchId: row.spawned_from_match_id ?? undefined,
    startsAt: row.starts_at,
    venue: row.venue,
    organizerId: row.organizer_id,
    maxPlayers: row.max_players,
    pricePerPerson: price !== undefined ? price : undefined,
    iban: row.iban ?? undefined,
    ibanAccountName: row.iban_account_name ?? undefined,
    paymentNote: row.payment_note ?? undefined,
    paymentMethod: row.payment_method,
    joinCode: row.join_code,
    attendees: domainAttendees,
    teamAIds,
    teamBIds,
    lineupLocked: row.lineup_locked,
    selfReportEnabled: row.self_report_enabled,
    status: row.status as MatchStatus,
    result,
    selfReports: domainSelf,
  };
}

/** RPC `submit_match_result` için gövde (onaylı self-report birleştirmesi sunucuda). */
export function scoreResultToRpcPayload(result: ScoreResult) {
  return {
    scorers: result.scorers.map((l) => ({ player_id: l.playerId, count: l.count })),
    assists: result.assists.map((l) => ({ player_id: l.playerId, count: l.count })),
  };
}

export function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    joinCode: row.join_code,
    createdAt: row.created_at,
  };
}

export function mapMembership(row: GroupMemberRow): GroupMembership {
  return {
    groupId: row.group_id,
    playerId: row.player_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function mapGroupWeeklySeries(row: GroupWeeklySeriesRow): GroupWeeklySeries {
  const price = numOrUndef(row.price_per_person);
  return {
    id: row.id,
    groupId: row.group_id,
    isActive: row.is_active,
    weekdayIsodow: row.weekday_isodow,
    localTime: row.local_time,
    timezone: row.timezone,
    venue: row.venue,
    maxPlayers: row.max_players,
    pricePerPerson: price !== undefined ? price : undefined,
    iban: row.iban ?? undefined,
    defaultOrganizerId: row.default_organizer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLeaderboardRow(row: PlayerLeaderboardStatsRow): PlayerLeaderboardStatsRow {
  return {
    ...row,
    goals: Number(row.goals),
    assists: Number(row.assists),
    matches_played: Number(row.matches_played),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
  };
}

export function jsonArrayOrEmpty<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}
