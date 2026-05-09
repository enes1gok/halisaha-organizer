import type { ScoreResult } from '../../../types/domain';
import type {
  GroupMemberRow,
  GroupRow,
  MatchAttendeeRow,
  MatchRow,
  MatchStatLineRow,
  MatchTeamPlayerRow,
  PlayerLeaderboardStatsRow,
  SelfReportRequestRow,
} from '../types';
import {
  jsonArrayOrEmpty,
  mapGroup,
  mapLeaderboardRow,
  mapMembership,
  numOrUndef,
  rsvpFromDb,
  rsvpToDb,
  rowsToMatch,
  scoreResultToRpcPayload,
} from '../mappers';

const iso = '2026-05-07T12:00:00.000Z';

function baseMatchRow(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: 'm1',
    group_id: null,
    series_id: null,
    spawned_from_match_id: null,
    starts_at: iso,
    venue: 'Field',
    organizer_id: 'org1',
    max_players: 10,
    price_per_person: null,
    iban: null,
    iban_account_name: null,
    payment_method: 'cash',
    payment_note: null,
    join_code: 'ABC123',
    lineup_locked: false,
    self_report_enabled: true,
    status: 'upcoming',
    score_a: null,
    score_b: null,
    created_at: iso,
    updated_at: iso,
    ...overrides,
  };
}

describe('rsvpFromDb / rsvpToDb', () => {
  it.each(['going', 'maybe'] as const)('round-trips %s', (status) => {
    expect(rsvpFromDb(status)).toBe(status);
    expect(rsvpToDb(status)).toBe(status);
  });

  it('maps not_going to notGoing and back', () => {
    expect(rsvpFromDb('not_going')).toBe('notGoing');
    expect(rsvpToDb('notGoing')).toBe('not_going');
  });
});

describe('rowsToMatch', () => {
  it('maps upcoming match with empty relations', () => {
    const row = baseMatchRow();
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.result).toBeUndefined();
    expect(match.teamAIds).toEqual([]);
    expect(match.teamBIds).toEqual([]);
    expect(match.attendees).toEqual([]);
    expect(match.selfReports).toEqual([]);
  });

  it('maps finished match with scores and stat lines', () => {
    const row = baseMatchRow({
      status: 'finished',
      score_a: 2,
      score_b: 1,
    });
    const statLines: MatchStatLineRow[] = [
      { match_id: row.id, player_id: 'p1', kind: 'assist', count: 1 },
      { match_id: row.id, player_id: 'p2', kind: 'goal', count: 2 },
      { match_id: row.id, player_id: 'p3', kind: 'goal', count: 1 },
    ];
    const match = rowsToMatch(row, [], [], statLines, []);
    expect(match.result).toEqual({
      scoreA: 2,
      scoreB: 1,
      scorers: [
        { playerId: 'p2', count: 2 },
        { playerId: 'p3', count: 1 },
      ],
      assists: [{ playerId: 'p1', count: 1 }],
    });
  });

  it('behavior-lock: finished with partial scores yields undefined result', () => {
    const row = baseMatchRow({
      status: 'finished',
      score_a: 1,
      score_b: null,
    });
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.result).toBeUndefined();
  });

  it('preserves team player order per side', () => {
    const row = baseMatchRow();
    const teamPlayers: MatchTeamPlayerRow[] = [
      { match_id: row.id, player_id: 'b1', team: 'B' },
      { match_id: row.id, player_id: 'a1', team: 'A' },
      { match_id: row.id, player_id: 'a2', team: 'A' },
      { match_id: row.id, player_id: 'b2', team: 'B' },
    ];
    const match = rowsToMatch(row, [], teamPlayers, [], []);
    expect(match.teamAIds).toEqual(['a1', 'a2']);
    expect(match.teamBIds).toEqual(['b1', 'b2']);
  });

  it('maps attendees paid and rsvp status', () => {
    const row = baseMatchRow();
    const attendees: MatchAttendeeRow[] = [
      { match_id: row.id, player_id: 'p1', status: 'going', paid: true },
      { match_id: row.id, player_id: 'p2', status: 'not_going', paid: false },
    ];
    const match = rowsToMatch(row, attendees, [], [], []);
    expect(match.attendees).toEqual([
      { playerId: 'p1', status: 'going', paid: true },
      { playerId: 'p2', status: 'notGoing', paid: false },
    ]);
  });

  it('maps self reports to domain shape', () => {
    const row = baseMatchRow();
    const selfReports: SelfReportRequestRow[] = [
      {
        id: 'sr1',
        match_id: row.id,
        player_id: 'p1',
        type: 'goal',
        status: 'pending',
        created_at: iso,
      },
    ];
    const match = rowsToMatch(row, [], [], [], selfReports);
    expect(match.selfReports).toEqual([
      {
        id: 'sr1',
        matchId: row.id,
        playerId: 'p1',
        type: 'goal',
        status: 'pending',
      },
    ]);
  });

  it('maps price_per_person null to undefined pricePerPerson', () => {
    const row = baseMatchRow({ price_per_person: null });
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.pricePerPerson).toBeUndefined();
  });

  it('maps numeric string price to number', () => {
    const row = {
      ...baseMatchRow(),
      price_per_person: '15.50',
    } as unknown as MatchRow;
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.pricePerPerson).toBe(15.5);
  });

  it('maps invalid numeric price to undefined', () => {
    const row = {
      ...baseMatchRow(),
      price_per_person: Number.NaN as unknown as number,
    };
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.pricePerPerson).toBeUndefined();
  });

  it('maps group_id null to undefined groupId', () => {
    const row = baseMatchRow({ group_id: null });
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.groupId).toBeUndefined();
  });

  it('maps group_id string to groupId', () => {
    const row = baseMatchRow({ group_id: 'g1' });
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.groupId).toBe('g1');
  });

  it('maps payment fields from DB', () => {
    const row = baseMatchRow({
      payment_method: 'iban',
      iban: 'TR330006100519786457841326',
      iban_account_name: 'ALI YILMAZ',
    });
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.paymentMethod).toBe('iban');
    expect(match.iban).toBe('TR330006100519786457841326');
    expect(match.ibanAccountName).toBe('ALI YILMAZ');
  });

  it('maps note_only payment note', () => {
    const row = baseMatchRow({
      payment_method: 'note_only',
      payment_note: 'Herkes kendi suyunu getirsin.',
      iban: null,
      iban_account_name: null,
    });
    const match = rowsToMatch(row, [], [], [], []);
    expect(match.paymentMethod).toBe('note_only');
    expect(match.paymentNote).toBe('Herkes kendi suyunu getirsin.');
  });
});

describe('scoreResultToRpcPayload', () => {
  it('maps domain stat lines to snake_case RPC payload order', () => {
    const result: ScoreResult = {
      scoreA: 1,
      scoreB: 0,
      scorers: [
        { playerId: 'a', count: 2 },
        { playerId: 'b', count: 1 },
      ],
      assists: [{ playerId: 'c', count: 1 }],
    };
    expect(scoreResultToRpcPayload(result)).toEqual({
      scorers: [
        { player_id: 'a', count: 2 },
        { player_id: 'b', count: 1 },
      ],
      assists: [{ player_id: 'c', count: 1 }],
    });
  });
});

describe('mapGroup / mapMembership', () => {
  it('maps group row snake_case to domain', () => {
    const row: GroupRow = {
      id: 'g1',
      name: 'Test',
      owner_id: 'u1',
      join_code: 'JOIN',
      created_at: iso,
    };
    expect(mapGroup(row)).toEqual({
      id: 'g1',
      name: 'Test',
      ownerId: 'u1',
      joinCode: 'JOIN',
      createdAt: iso,
    });
  });

  it('maps membership roles unchanged', () => {
    const owner: GroupMemberRow = {
      group_id: 'g1',
      player_id: 'u1',
      role: 'owner',
      created_at: iso,
    };
    const member: GroupMemberRow = {
      group_id: 'g1',
      player_id: 'u2',
      role: 'member',
      created_at: iso,
    };
    expect(mapMembership(owner)).toEqual({
      groupId: 'g1',
      playerId: 'u1',
      role: 'owner',
      createdAt: iso,
    });
    expect(mapMembership(member).role).toBe('member');
  });
});

describe('mapLeaderboardRow', () => {
  it('coerces string stats to numbers', () => {
    const row = {
      player_id: 'p1',
      goals: '3',
      assists: '1',
      matches_played: '5',
      wins: '2',
      losses: '1',
      draws: '2',
    } as unknown as PlayerLeaderboardStatsRow;
    expect(mapLeaderboardRow(row)).toEqual({
      player_id: 'p1',
      goals: 3,
      assists: 1,
      matches_played: 5,
      wins: 2,
      losses: 1,
      draws: 2,
    });
  });

  it('leaves numeric fields unchanged', () => {
    const row: PlayerLeaderboardStatsRow = {
      player_id: 'p1',
      goals: 4,
      assists: 0,
      matches_played: 2,
      wins: 1,
      losses: 1,
      draws: 0,
    };
    expect(mapLeaderboardRow(row)).toEqual(row);
  });
});

describe('jsonArrayOrEmpty', () => {
  it('returns empty array for null, undefined, non-array', () => {
    expect(jsonArrayOrEmpty(null)).toEqual([]);
    expect(jsonArrayOrEmpty(undefined)).toEqual([]);
    expect(jsonArrayOrEmpty({} as unknown as string[])).toEqual([]);
  });

  it('returns same array reference for valid arrays', () => {
    const arr = [1, 2];
    expect(jsonArrayOrEmpty(arr)).toBe(arr);
  });

  it('parses JSON string arrays', () => {
    expect(jsonArrayOrEmpty('[1,2]')).toEqual([1, 2]);
    expect(jsonArrayOrEmpty('{"not":"array"}')).toEqual([]);
    expect(jsonArrayOrEmpty('not json')).toEqual([]);
  });
});

describe('numOrUndef', () => {
  it('returns undefined for null, undefined, NaN', () => {
    expect(numOrUndef(null)).toBeUndefined();
    expect(numOrUndef(undefined)).toBeUndefined();
    expect(numOrUndef(Number.NaN)).toBeUndefined();
  });

  it('parses finite strings and numbers', () => {
    expect(numOrUndef(10)).toBe(10);
    expect(numOrUndef('2.5')).toBe(2.5);
  });
});
