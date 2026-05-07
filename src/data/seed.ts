import { addDays, setHours, setMinutes, subDays } from 'date-fns';
import type { Match, Player } from '../types/domain';
import { createJoinCode } from '../utils/id';
import { recomputePlayerStatsFromMatches } from '../utils/stats';

export const CURRENT_USER_ID = 'player-1';

const basePlayers: Omit<Player, 'stats'>[] = [
  {
    id: 'player-1',
    name: 'Ahmet Yılmaz',
    iban: 'TR330006100519786457841326',
    position: 'MID',
    preferredFoot: 'both',
  },
  {
    id: 'player-2',
    name: 'Mehmet Kaya',
    position: 'DEF',
    preferredFoot: 'right',
  },
  {
    id: 'player-3',
    name: 'Can Öztürk',
    position: 'FWD',
    preferredFoot: 'left',
  },
  {
    id: 'player-4',
    name: 'Emre Demir',
    position: 'GK',
    preferredFoot: 'right',
  },
  {
    id: 'player-5',
    name: 'Burak Şahin',
    position: 'MID',
    preferredFoot: 'both',
  },
  {
    id: 'player-6',
    name: 'Ali Çelik',
    position: 'DEF',
    preferredFoot: 'left',
  },
  {
    id: 'player-7',
    name: 'Kerem Arslan',
    position: 'FWD',
    preferredFoot: 'right',
  },
  {
    id: 'player-8',
    name: 'Onur Yıldız',
    position: 'MID',
    preferredFoot: 'right',
  },
];

function atTime(d: Date, hour: number, minute: number): string {
  return setMinutes(setHours(d, hour), minute).toISOString();
}

function buildMatches(now: Date): Match[] {
  const past1Day = subDays(now, 10);
  const past2Day = subDays(now, 3);
  const upcomingDay = addDays(now, 2);

  const matchPast1: Match = {
    id: 'match-past-1',
    startsAt: atTime(past1Day, 20, 0),
    venue: 'Kadıköy Halı Saha Parkı',
    organizerId: 'player-1',
    maxPlayers: 14,
    pricePerPerson: 150,
    iban: 'TR330006100519786457841326',
    joinCode: 'HS-KDK1',
    lineupLocked: true,
    selfReportEnabled: false,
    attendees: [
      { playerId: 'player-1', status: 'going', paid: true },
      { playerId: 'player-2', status: 'going', paid: true },
      { playerId: 'player-3', status: 'going', paid: true },
      { playerId: 'player-4', status: 'going', paid: true },
      { playerId: 'player-5', status: 'going', paid: true },
      { playerId: 'player-6', status: 'going', paid: true },
      { playerId: 'player-7', status: 'going', paid: true },
      { playerId: 'player-8', status: 'going', paid: true },
    ],
    teamAIds: ['player-1', 'player-2', 'player-3', 'player-4'],
    teamBIds: ['player-5', 'player-6', 'player-7', 'player-8'],
    status: 'finished',
    result: {
      scoreA: 5,
      scoreB: 4,
      scorers: [
        { playerId: 'player-1', count: 2 },
        { playerId: 'player-2', count: 1 },
        { playerId: 'player-3', count: 2 },
        { playerId: 'player-7', count: 2 },
        { playerId: 'player-8', count: 2 },
      ],
      assists: [
        { playerId: 'player-2', count: 2 },
        { playerId: 'player-5', count: 3 },
        { playerId: 'player-6', count: 1 },
      ],
    },
    selfReports: [],
  };

  const matchPast2: Match = {
    id: 'match-past-2',
    startsAt: atTime(past2Day, 21, 30),
    venue: 'Beşiktaş Arena Mini',
    organizerId: 'player-3',
    maxPlayers: 14,
    pricePerPerson: 200,
    iban: 'TR640012345678901234567890',
    joinCode: 'HS-BTK2',
    lineupLocked: true,
    selfReportEnabled: false,
    attendees: [
      { playerId: 'player-1', status: 'going', paid: true },
      { playerId: 'player-2', status: 'going', paid: true },
      { playerId: 'player-3', status: 'going', paid: true },
      { playerId: 'player-4', status: 'going', paid: true },
      { playerId: 'player-5', status: 'going', paid: true },
      { playerId: 'player-6', status: 'going', paid: true },
      { playerId: 'player-7', status: 'going', paid: true },
      { playerId: 'player-8', status: 'going', paid: true },
    ],
    teamAIds: ['player-1', 'player-3', 'player-5', 'player-7'],
    teamBIds: ['player-2', 'player-4', 'player-6', 'player-8'],
    status: 'finished',
    result: {
      scoreA: 3,
      scoreB: 2,
      scorers: [
        { playerId: 'player-1', count: 1 },
        { playerId: 'player-3', count: 1 },
        { playerId: 'player-5', count: 1 },
        { playerId: 'player-4', count: 1 },
        { playerId: 'player-8', count: 1 },
      ],
      assists: [
        { playerId: 'player-3', count: 2 },
        { playerId: 'player-1', count: 1 },
        { playerId: 'player-6', count: 1 },
      ],
    },
    selfReports: [],
  };

  const matchUpcoming: Match = {
    id: 'match-upcoming-1',
    startsAt: atTime(upcomingDay, 19, 0),
    venue: 'Üsküdar Spor Kompleksi',
    organizerId: 'player-1',
    maxPlayers: 14,
    pricePerPerson: 180,
    iban: 'TR210001009012345678901234',
    joinCode: 'HS-USK9',
    lineupLocked: false,
    selfReportEnabled: false,
    attendees: [
      { playerId: 'player-1', status: 'going', paid: false },
      { playerId: 'player-2', status: 'going', paid: true },
      { playerId: 'player-3', status: 'going', paid: true },
      { playerId: 'player-4', status: 'going', paid: false },
      { playerId: 'player-5', status: 'going', paid: true },
      { playerId: 'player-6', status: 'going', paid: true },
      { playerId: 'player-7', status: 'maybe', paid: false },
      { playerId: 'player-8', status: 'notGoing', paid: false },
    ],
    teamAIds: [],
    teamBIds: [],
    status: 'upcoming',
    selfReports: [],
  };

  return [matchPast1, matchPast2, matchUpcoming];
}

export function buildSeedState(now: Date = new Date()): {
  players: Player[];
  matches: Match[];
} {
  const matches = buildMatches(now);
  const zeroStats = {
    matchesPlayed: 0,
    goals: 0,
    assists: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };
  const playersRaw: Player[] = basePlayers.map((p) => ({
    ...p,
    stats: { ...zeroStats },
  }));
  const players = recomputePlayerStatsFromMatches(playersRaw, matches);
  return { players, matches };
}

export const STORE_VERSION = 1;

/** Generate join code for new matches (seed uses fixed codes) */
export { createJoinCode };
