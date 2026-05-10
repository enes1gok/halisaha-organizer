import type { Match, Player } from '../../types/domain';
import { buildLeaderboard } from '../leaderboard';

/** Gol/asist sıfırken boş sıra — LeaderboardScreen boş durum + CTA senaryosu */
describe('buildLeaderboard empty rows', () => {
  it('gol metrikte sıfır katkıda satır üretmez', () => {
    const players: Player[] = [
      {
        id: 'p1',
        name: 'Test',
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
    ];
    const matches: Match[] = [];
    const rows = buildLeaderboard(players, matches, 'goals', 'all', new Date(), undefined);
    expect(rows).toHaveLength(0);
  });
});
