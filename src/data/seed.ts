import type { Match, Player } from '../types/domain';
import { createJoinCode } from '../utils/id';

export const CURRENT_USER_ID = 'local-user';

export function buildSeedState(now: Date = new Date()): {
  players: Player[];
  matches: Match[];
} {
  void now;
  return {
    players: [
      {
        id: CURRENT_USER_ID,
        name: 'Oyuncu',
        position: 'MID',
        preferredFoot: 'both',
        stats: {
          matchesPlayed: 0,
          goals: 0,
          assists: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        },
      },
    ],
    matches: [],
  };
}

export const STORE_VERSION = 3;

/** Generate join code for new matches (seed uses fixed codes) */
export { createJoinCode };
