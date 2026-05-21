import { useEffect, useState } from 'react';

export type RatingWindowInput = {
  /** Maçın başlangıç zamanı (ISO). Rating bu andan itibaren açılır. */
  startsAt?: string | null;
  /** Organizatör kapattığında dolar (ISO). Yeni maçlar için birincil kapanış mekanizması. */
  ratingClosedAt?: string | null;
  /** Eski maçlarda otomatik kapanış zamanı (ISO). `ratingClosedAt` yoksa fallback. */
  ratingWindowEndsAt?: string | null;
};

type RatingWindowState = {
  /** Pencere açık (maç başladı, henüz kapatılmadı) mı? */
  isOpen: boolean;
  /** Pencere kapandı mı? (organizatör kapattı ya da eski auto-close doldu). */
  isClosed: boolean;
  /** Kapanışa kalan saniye; null = yeni maçlarda organizatör kapatana kadar sayaç yok. */
  secondsLeft: number | null;
};

function computeState(input: RatingWindowInput): RatingWindowState {
  const { startsAt, ratingClosedAt, ratingWindowEndsAt } = input;

  // Maç başlamamışsa → açık değil, ama "kapandı" da değil (henüz başlamadı)
  if (!startsAt || Date.now() < new Date(startsAt).getTime()) {
    return { isOpen: false, isClosed: false, secondsLeft: null };
  }

  // Organizatör manuel kapattıysa → kapalı
  if (ratingClosedAt) {
    return { isOpen: false, isClosed: true, secondsLeft: null };
  }

  // Eski maçlar: rating_window_ends_at varsa kontrol et
  if (ratingWindowEndsAt) {
    const endsAtMs = new Date(ratingWindowEndsAt).getTime();
    const diff = endsAtMs - Date.now();
    if (diff <= 0) {
      return { isOpen: false, isClosed: true, secondsLeft: null };
    }
    return { isOpen: true, isClosed: false, secondsLeft: Math.ceil(diff / 1000) };
  }

  // Yeni maç: başladı, kapatılmadı → açık, sayaç yok
  return { isOpen: true, isClosed: false, secondsLeft: null };
}

/**
 * Puanlama penceresini izler.
 *
 * Yeni akış: maç başladığında açılır, organizatör `close_match_rating` ile kapatır.
 * Eski akış: `ratingWindowEndsAt` dolduğunda kapanır (geriye uyumluluk).
 */
export function useRatingWindow(input: RatingWindowInput): RatingWindowState {
  const [state, setState] = useState<RatingWindowState>(() => computeState(input));

  const { startsAt, ratingClosedAt, ratingWindowEndsAt } = input;

  useEffect(() => {
    setState(computeState({ startsAt, ratingClosedAt, ratingWindowEndsAt }));

    // Yeni maçlarda (organizatör kapatır) countdown yoktur — sadece closed değişince dışarıdan re-render tetiklenir.
    if (ratingClosedAt) return;

    // Eski maçlar: rating_window_ends_at bazlı tick
    if (!ratingWindowEndsAt) return;

    const endsAtMs = new Date(ratingWindowEndsAt).getTime();

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (cancelled) return;
      const next = computeState({ startsAt, ratingClosedAt, ratingWindowEndsAt });
      setState(next);
      if (next.isClosed) return;

      const msLeft = endsAtMs - Date.now();
      const delay = msLeft < 60_000 ? 1_000 : 60_000;
      timeoutId = setTimeout(tick, delay);
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [startsAt, ratingClosedAt, ratingWindowEndsAt]);

  return state;
}
