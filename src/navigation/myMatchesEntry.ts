import type { Match } from '../types/domain';
import { isRemoteMatchId } from '../utils/matchId';

export type MyMatchesEntryScreen = 'MatchRatingFlow' | 'MatchSummary' | 'MatchDetail';

/**
 * Remote maçlar için Maçlarım satır hedef ekranı. Yerel (seed/demo) maçlar her zaman detaydadır.
 *
 * Yeni akış: derecelendirme penceresi maç başladığında (starts_at <= now) açılır,
 * organizatör manuel kapatana kadar (rating_closed_at) açık kalır.
 * Eski akış: rating_window_ends_at tabanlı auto-close (geriye uyumluluk).
 */
export function resolveMyMatchesEntryScreen(
  match: Match,
  userId: string,
  ratingsSubmittedByMatchId: Record<string, true | undefined>,
): MyMatchesEntryScreen {
  if (!isRemoteMatchId(match.id)) {
    return 'MatchDetail';
  }

  if (match.status === 'cancelled') {
    return 'MatchDetail';
  }

  const onLineup = match.teamAIds.includes(userId) || match.teamBIds.includes(userId);
  const alreadySubmitted = !!ratingsSubmittedByMatchId[match.id];
  const matchHasStarted = !!match.startsAt && Date.now() >= new Date(match.startsAt).getTime();

  // Derecelendirme kapalı mı? Organizatör kapattıysa (yeni) veya eski auto-close dolduysa.
  const ratingClosed =
    !!match.ratingClosedAt ||
    (!!match.ratingWindowEndsAt && Date.now() > new Date(match.ratingWindowEndsAt).getTime());

  // Maç başladı, kullanıcı kadrodaysa ve pencere açıksa → derecelendirme akışına yönlendir
  if (matchHasStarted && onLineup && !alreadySubmitted && !ratingClosed) {
    return 'MatchRatingFlow';
  }

  if (match.status === 'finished') {
    return 'MatchSummary';
  }

  return 'MatchDetail';
}
