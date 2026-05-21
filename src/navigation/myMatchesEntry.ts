import type { Match } from '../types/domain';
import { isRemoteMatchId } from '../utils/matchId';

export type MyMatchesEntryScreen = 'MatchRatingFlow' | 'MatchSummary' | 'MatchDetail';

/**
 * Remote maçlar için Maçlarım satır hedef ekranı. Yerel (seed/demo) maçlar her zaman detaydadır.
 *
 * Yeni akış: derecelendirme penceresi maç başladığında (starts_at <= now) açılır,
 * organizatör manuel kapatana kadar (rating_closed_at) açık kalır.
 * Eski akış: rating_window_ends_at tabanlı auto-close (geriye uyumluluk).
 *
 * Önemli: finished maçlar MatchRatingFlow'dan önce MatchSummary'ye yönlendirilir.
 * Bu Zustand persist rehydration race condition'ını (alreadySubmitted yanlış false
 * dönebilir) önler. Rating CTA MatchSummary → MatchDetail üzerinden erişilebilir.
 */
export function resolveMyMatchesEntryScreen(
  match: Match,
  userId: string,
  ratingsSubmittedByMatchId: Record<string, true | undefined>,
): MyMatchesEntryScreen {
  if (!isRemoteMatchId(match.id)) return 'MatchDetail';
  if (match.status === 'cancelled') return 'MatchDetail';

  // Bitmiş maçlar her zaman özet ekranına gider — rehydration race condition'ını önler.
  // Rating CTA MatchSummary içindeki MatchDetailScreen'den erişilebilir.
  if (match.status === 'finished') return 'MatchSummary';

  const onLineup = match.teamAIds.includes(userId) || match.teamBIds.includes(userId);
  const alreadySubmitted = !!ratingsSubmittedByMatchId[match.id];
  const matchHasStarted = !!match.startsAt && Date.now() >= new Date(match.startsAt).getTime();

  // Derecelendirme kapalı mı? Organizatör kapattıysa (yeni) veya eski auto-close dolduysa.
  const ratingClosed =
    !!match.ratingClosedAt ||
    (!!match.ratingWindowEndsAt && Date.now() > new Date(match.ratingWindowEndsAt).getTime());

  // Henüz bitmemiş maç başladı, kullanıcı kadrodaysa ve pencere açıksa → rating akışı
  if (matchHasStarted && onLineup && !alreadySubmitted && !ratingClosed) {
    return 'MatchRatingFlow';
  }

  return 'MatchDetail';
}
