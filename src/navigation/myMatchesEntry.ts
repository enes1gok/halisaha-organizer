import type { Match } from '../types/domain';
import { isRemoteMatchId } from '../utils/matchId';

export type MyMatchesEntryScreen = 'MatchRatingFlow' | 'MatchSummary' | 'MatchDetail';

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

  if (match.status !== 'finished') {
    return 'MatchDetail';
  }

  if (!match.result) {
    // Skor girilmemiş — organizatör MatchDetail'da skor girebilir
    return 'MatchDetail';
  }

  if (!onLineup || ratingsSubmittedByMatchId[match.id]) {
    return 'MatchSummary';
  }

  // Puanlama penceresi kapandıysa final ekrana git
  if (match.ratingWindowEndsAt && new Date(match.ratingWindowEndsAt).getTime() < Date.now()) {
    return 'MatchSummary';
  }

  return 'MatchRatingFlow';
}
