import type {
  Attendee,
  Group,
  GroupMembership,
  GroupWeeklySeries,
  GuestAttendee,
  Match,
  MatchStatus,
  Position,
  RSVPStatus,
  ScoreResult,
  SelfReportApprovalStatus,
  SelfReportRequest,
  SelfReportType,
  StatLine,
} from '../../types/domain';
import { getLineupFormationById } from '../../data/lineupFormations';
import type {
  GroupMemberRow,
  GroupRow,
  GroupWeeklySeriesRow,
  MatchAttendeeRow,
  MatchGuestAttendeeRow,
  MatchGuestTeamAssignmentRow,
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

export function mapAttendeeRow(row: MatchAttendeeRow): import('../../types/domain').Attendee {
  return {
    playerId: row.player_id,
    status: rsvpFromDb(row.status),
    paid: row.paid,
    ...(row.waitlisted_at != null && { waitlistedAt: row.waitlisted_at }),
  };
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

export function mapGuestAttendeeRow(g: MatchGuestAttendeeRow): GuestAttendee {
  return {
    id: g.id,
    matchId: g.match_id,
    displayName: g.display_name,
    position: g.position as Position,
    paid: g.paid,
    addedBy: g.added_by,
  };
}

/** Slot index — null sona, dolu slotlar slot_index sırasına, sonra player_id stabilizasyonu. */
function sortByTeamSlotIndex<T extends { slot_index?: number | null; player_id?: string; guest_id?: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ai = a.slot_index;
    const bi = b.slot_index;
    if (ai == null && bi == null) {
      const ak = (a.player_id ?? a.guest_id ?? '') as string;
      const bk = (b.player_id ?? b.guest_id ?? '') as string;
      return ak.localeCompare(bk);
    }
    if (ai == null) return 1;
    if (bi == null) return -1;
    if (ai !== bi) return ai - bi;
    const ak = (a.player_id ?? a.guest_id ?? '') as string;
    const bk = (b.player_id ?? b.guest_id ?? '') as string;
    return ak.localeCompare(bk);
  });
}

export function rowsToMatch(
  row: MatchRow,
  attendees: MatchAttendeeRow[],
  teamPlayers: MatchTeamPlayerRow[],
  statLines: MatchStatLineRow[],
  selfReports: SelfReportRequestRow[],
  guestAttendeeRows: MatchGuestAttendeeRow[] = [],
  guestTeamRows: MatchGuestTeamAssignmentRow[] = [],
): Match {
  const teamARows = sortByTeamSlotIndex(teamPlayers.filter((t) => t.team === 'A'));
  const teamBRows = sortByTeamSlotIndex(teamPlayers.filter((t) => t.team === 'B'));
  const guestARows = sortByTeamSlotIndex(guestTeamRows.filter((g) => g.team === 'A'));
  const guestBRows = sortByTeamSlotIndex(guestTeamRows.filter((g) => g.team === 'B'));

  const registeredTeamAIds = teamARows.map((t) => t.player_id);
  const registeredTeamBIds = teamBRows.map((t) => t.player_id);
  const guestTeamAIds = guestARows.map((g) => g.guest_id);
  const guestTeamBIds = guestBRows.map((g) => g.guest_id);
  const teamAIds = [...registeredTeamAIds, ...guestTeamAIds];
  const teamBIds = [...registeredTeamBIds, ...guestTeamBIds];

  const lineupFormationId = row.lineup_formation_id ?? undefined;
  const formation = lineupFormationId ? getLineupFormationById(lineupFormationId) : undefined;
  let lineupSlotsA: (string | null)[] | undefined;
  let lineupSlotsB: (string | null)[] | undefined;
  if (formation) {
    const slotCount = formation.playersPerTeam;
    const buildSlots = (
      regRows: readonly MatchTeamPlayerRow[],
      gRows: readonly MatchGuestTeamAssignmentRow[],
    ): (string | null)[] => {
      const slots: (string | null)[] = Array.from({ length: slotCount }, () => null);
      for (const r of regRows) {
        if (r.slot_index == null) continue;
        if (r.slot_index >= 0 && r.slot_index < slotCount) slots[r.slot_index] = r.player_id;
      }
      for (const r of gRows) {
        if (r.slot_index == null) continue;
        if (r.slot_index >= 0 && r.slot_index < slotCount) slots[r.slot_index] = r.guest_id;
      }
      return slots;
    };
    const hasAnySlotA =
      teamARows.some((t) => t.slot_index != null) || guestARows.some((g) => g.slot_index != null);
    const hasAnySlotB =
      teamBRows.some((t) => t.slot_index != null) || guestBRows.some((g) => g.slot_index != null);
    if (hasAnySlotA) lineupSlotsA = buildSlots(teamARows, guestARows);
    if (hasAnySlotB) lineupSlotsB = buildSlots(teamBRows, guestBRows);
  }

  const domainAttendees: Attendee[] = attendees.map(mapAttendeeRow);

  let result: ScoreResult | undefined;
  // TODO: surface partial-score as bug — finished + null score currently yields result undefined
  if (row.status === 'finished' && row.score_a != null && row.score_b != null) {
    const scorers: StatLine[] = statLines
      .filter((l) => l.kind === 'goal')
      .map((l) => ({ playerId: l.player_id, count: l.count }));
    const assists: StatLine[] = statLines
      .filter((l) => l.kind === 'assist')
      .map((l) => ({ playerId: l.player_id, count: l.count }));
    const ownGoals: StatLine[] = statLines
      .filter((l) => l.kind === 'own_goal')
      .map((l) => ({ playerId: l.player_id, count: l.count }));
    result = {
      scoreA: row.score_a,
      scoreB: row.score_b,
      scorers,
      assists,
      ownGoals,
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
    lineupFormationId,
    lineupSlotsA,
    lineupSlotsB,
    lineupLocked: row.lineup_locked,
    selfReportEnabled: row.self_report_enabled,
    status: row.status as MatchStatus,
    result,
    selfReports: domainSelf,
    ratingWindowEndsAt: row.rating_window_ends_at ?? undefined,
    guestAttendees: guestAttendeeRows.map(mapGuestAttendeeRow),
  };
}

/** RPC `submit_match_result` için gövde (onaylı self-report birleştirmesi sunucuda). */
export function scoreResultToRpcPayload(result: ScoreResult) {
  return {
    scorers: result.scorers.map((l) => ({ player_id: l.playerId, count: l.count })),
    assists: result.assists.map((l) => ({ player_id: l.playerId, count: l.count })),
    own_goals: (result.ownGoals ?? []).map((l) => ({ player_id: l.playerId, count: l.count })),
  };
}

export function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    joinCode: row.join_code,
    createdAt: row.created_at,
    photoUri: row.photo_uri ?? undefined,
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

export function jsonArrayOrEmpty<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
