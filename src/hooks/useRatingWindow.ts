import { useEffect, useState } from 'react';

type RatingWindowState = {
  /** Pencere açık (henüz kapanmadı) mı? */
  isOpen: boolean;
  /** Pencere kapandı mı? (null endsAt → eski maç → kapalı sayılır). */
  isClosed: boolean;
  /** Kapanışa kalan saniye; null = kapalı veya endsAt yok. */
  secondsLeft: number | null;
};

function computeState(endsAtMs: number | null): RatingWindowState {
  if (endsAtMs === null) {
    return { isOpen: false, isClosed: true, secondsLeft: null };
  }
  const diff = endsAtMs - Date.now();
  if (diff <= 0) {
    return { isOpen: false, isClosed: true, secondsLeft: null };
  }
  return { isOpen: true, isClosed: false, secondsLeft: Math.ceil(diff / 1000) };
}

/**
 * Puanlama penceresini izler. 1 dakika tick, pencere kapandığında tek son tick.
 * `endsAt` null → eski maç → pencere kapalı sayılır.
 */
export function useRatingWindow(endsAt: string | null | undefined): RatingWindowState {
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null;
  const [state, setState] = useState<RatingWindowState>(() => computeState(endsAtMs));

  useEffect(() => {
    if (endsAtMs === null) {
      setState({ isOpen: false, isClosed: true, secondsLeft: null });
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (cancelled) return;
      const next = computeState(endsAtMs);
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
  }, [endsAtMs]);

  return state;
}
