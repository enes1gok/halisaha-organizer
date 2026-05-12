import { useEffect, useState } from 'react';
import type { Match } from '../types/domain';
import { getEffectiveStatus, type EffectiveStatus } from '../utils/matchEffectiveStatus';
import { isPastMatchEnd } from '../utils/matchTiming';

/**
 * Maç başlama saatine göre efectiveStatus'ü takip eder.
 * `startsAt`'a 2 dk kala 1 sn, aksi halde 30 sn yenilenir.
 */
export function useEffectiveMatchStatus(match: Pick<Match, 'status' | 'startsAt'> | undefined) {
  const [effective, setEffective] = useState<EffectiveStatus>(() =>
    match ? getEffectiveStatus(match) : 'upcoming',
  );
  const [pastScheduledEnd, setPastScheduledEnd] = useState(() =>
    match ? isPastMatchEnd(match.startsAt) : false,
  );

  const startsAt = match?.startsAt;
  const status = match?.status;

  useEffect(() => {
    if (!startsAt || !status) {
      setEffective('upcoming');
      setPastScheduledEnd(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (cancelled) return;
      const nowMs = Date.now();
      setEffective(getEffectiveStatus({ status: status as Match['status'], startsAt }, nowMs));
      setPastScheduledEnd(isPastMatchEnd(startsAt, nowMs));

      const startsMs = new Date(startsAt).getTime();
      const msUntilStart = startsMs - nowMs;
      const delay = msUntilStart > 0 && msUntilStart < 120_000 ? 1_000 : 30_000;
      timeoutId = setTimeout(tick, delay);
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [startsAt, status]);

  return { effective, isOngoing: effective === 'ongoing', pastScheduledEnd };
}
