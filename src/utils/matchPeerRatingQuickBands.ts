export type QuickRatingBandId = 'great' | 'good' | 'mid' | 'weak';

export interface QuickRatingBand {
  id: QuickRatingBandId;
  label: string;
  score: number;
}

/** Ön tanımlı hızlı derecelendirme bantları → sunucuya gönderilen 0–100 tam sayı. */
export const QUICK_RATING_BANDS: readonly QuickRatingBand[] = [
  { id: 'great', label: 'Harika', score: 90 },
  { id: 'good', label: 'İyi', score: 75 },
  { id: 'mid', label: 'Orta', score: 60 },
  { id: 'weak', label: 'Zayıf', score: 45 },
] as const;

const bandById = Object.fromEntries(QUICK_RATING_BANDS.map((b) => [b.id, b])) as Record<
  QuickRatingBandId,
  QuickRatingBand
>;

export function quickBandById(id: QuickRatingBandId): QuickRatingBand {
  return bandById[id];
}

/** En yakın bant kimliği (mesafe eşitse dizide önce gelen / daha yüksek skorlu bant seçilir). */
export function nearestQuickBandId(score: number): QuickRatingBandId {
  const clamped = Math.min(100, Math.max(0, score));
  // QUICK_RATING_BANDS asla boş değil — non-null assertion compile-time invariant.
  let best = QUICK_RATING_BANDS[0]!;
  let bestDist = Math.abs(clamped - best.score);
  for (let i = 1; i < QUICK_RATING_BANDS.length; i++) {
    const b = QUICK_RATING_BANDS[i]!;
    const d = Math.abs(clamped - b.score);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best.id;
}
