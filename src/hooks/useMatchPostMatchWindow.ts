import { useEffect, useMemo, useState } from 'react';
import { getMatchEndsAtIso, isPastMatchEnd } from '../utils/matchTiming';

/**
 * Tahmini maç bitişine göre skor giriş penceresinin açılıp açılmadığını takip eder.
 * Bitişe 2 dk kala 1 sn, aksi halde 30 sn yenilenir.
 */
export function useMatchPostMatchWindow(startsAt: string | undefined) {
  const endsAtIso = useMemo(
    () => (startsAt ? getMatchEndsAtIso(startsAt) : ''),
    [startsAt],
  );

  const [pastScheduledEnd, setPastScheduledEnd] = useState(() =>
    startsAt ? isPastMatchEnd(startsAt) : false,
  );

  useEffect(() => {
    if (!startsAt) {
      setPastScheduledEnd(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (cancelled) return;
      setPastScheduledEnd(isPastMatchEnd(startsAt));
      const endMs = new Date(getMatchEndsAtIso(startsAt)).getTime();
      const msUntil = endMs - Date.now();
      const delay = msUntil > 0 && msUntil < 120_000 ? 1000 : 30_000;
      timeoutId = setTimeout(tick, delay);
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [startsAt]);

  return { pastScheduledEnd, endsAtIso };
}
