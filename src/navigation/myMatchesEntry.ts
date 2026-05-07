import type { Match } from '../types/domain';
import { isRemoteMatchId } from '../utils/matchId';

export type MyMatchesEntryScreen = 'MatchPregame' | 'MatchPostgame' | 'MatchSummary' | 'MatchDetail';

/**
 * Remote maçlar için Maçlarım satır hedef ekranı. Yerel (seed/demo) maçlar her zaman detaydadır.
 */
export function resolveMyMatchesEntryScreen(
  match: Match,
  userId: string,
  ratingsSubmittedByMatchId: Record<string, true | undefined>,
): MyMatchesEntryScreen {
  if (!isRemoteMatchId(match.id)) {
    return 'MatchDetail';
  }

  const onLineup = match.teamAIds.includes(userId) || match.teamBIds.includes(userId);

  if (match.status === 'upcoming' || match.status === 'ongoing') {
    return 'MatchPregame';
  }

  if (match.status !== 'finished') {
    return 'MatchDetail';
  }

  if (!match.result) {
    return 'MatchPostgame';
  }

  if (!onLineup || ratingsSubmittedByMatchId[match.id]) {
    return 'MatchSummary';
  }

  return 'MatchPostgame';
}
