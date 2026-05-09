import { useCallback, useMemo, useRef, useState } from 'react';
import { startOfDay, startOfMonth } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import type { Match } from '../../../types/domain';
import { useAppStore } from '../../../store/useAppStore';
import { useSupabaseAuth } from '../../../context/SupabaseAuthContext';
import {
  buildAgendaSections,
  dayKeyOf,
  filterMatchesBySegment,
  groupMatchesByDay,
  shiftMonth,
  type AgendaSection,
  type SegmentValue,
} from '../adapters/groupMatchesByDay';

export type UseMyMatchesData = {
  segment: SegmentValue;
  setSegment: (next: SegmentValue) => void;
  monthAnchor: Date;
  setMonthAnchor: (date: Date) => void;
  shiftMonthBy: (delta: number) => void;
  selectedDateKey: string | null;
  setSelectedDateKey: (key: string | null) => void;
  resetToToday: () => void;
  today: Date;
  dotsByDay: Map<string, number>;
  sections: AgendaSection[];
  hasAnyMatches: boolean;
  ratingsSubmission: Record<string, true | undefined>;
  userId: string;
  refresh: () => Promise<void>;
  refreshing: boolean;
  showInitialSkeleton: boolean;
};

export function useMyMatchesData(): UseMyMatchesData {
  const slice = useAppStore(
    useShallow((s) => ({
      matches: s.matches,
      userId: s.getCurrentUserId(),
      remoteUserId: s.remoteUserId,
      hydrateRemoteMatches: s.hydrateRemoteMatches,
      ratingsSubmission: s.matchRatingsSubmissionByMatchId,
    })),
  );
  const { configured, loading } = useSupabaseAuth();

  const todayRef = useRef<Date>(startOfDay(new Date()));
  const today = todayRef.current;

  const [segment, setSegment] = useState<SegmentValue>('upcoming');
  const [monthAnchor, setMonthAnchorRaw] = useState<Date>(() => startOfMonth(today));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const setMonthAnchor = useCallback((date: Date) => {
    setMonthAnchorRaw(startOfMonth(date));
  }, []);

  const shiftMonthBy = useCallback((delta: number) => {
    setMonthAnchorRaw((prev) => shiftMonth(prev, delta));
  }, []);

  const resetToToday = useCallback(() => {
    setMonthAnchorRaw(startOfMonth(todayRef.current));
    setSelectedDateKey(null);
  }, []);

  const mine = useMemo<Match[]>(() => {
    return slice.matches.filter((m) => {
      if (m.status === 'cancelled') return false;
      if (m.organizerId === slice.userId) return true;
      const att = m.attendees.find((a) => a.playerId === slice.userId);
      return !!att && (att.status === 'going' || att.status === 'maybe');
    });
  }, [slice.matches, slice.userId]);

  const filtered = useMemo(
    () => filterMatchesBySegment(mine, segment, today),
    [mine, segment, today],
  );

  const dotsByDay = useMemo<Map<string, number>>(() => {
    const grouped = groupMatchesByDay(filtered);
    const counts = new Map<string, number>();
    for (const [key, list] of grouped) counts.set(key, list.length);
    return counts;
  }, [filtered]);

  const sections = useMemo(
    () => buildAgendaSections(mine, segment, today),
    [mine, segment, today],
  );

  const refresh = useCallback(async () => {
    if (!slice.remoteUserId) return;
    setRefreshing(true);
    try {
      await slice.hydrateRemoteMatches();
    } finally {
      setRefreshing(false);
    }
  }, [slice.hydrateRemoteMatches, slice.remoteUserId]);

  const handleSetSelectedDateKey = useCallback(
    (key: string | null) => {
      setSelectedDateKey(key);
      if (key) {
        const parts = key.split('-');
        if (parts.length === 3) {
          const [y, m] = parts.map((p) => Number.parseInt(p, 10));
          if (Number.isFinite(y) && Number.isFinite(m)) {
            const target = startOfMonth(new Date(y, m - 1, 1));
            if (target.getTime() !== monthAnchor.getTime()) {
              setMonthAnchorRaw(target);
            }
          }
        }
      }
    },
    [monthAnchor],
  );

  return {
    segment,
    setSegment,
    monthAnchor,
    setMonthAnchor,
    shiftMonthBy,
    selectedDateKey,
    setSelectedDateKey: handleSetSelectedDateKey,
    resetToToday,
    today,
    dotsByDay,
    sections,
    hasAnyMatches: mine.length > 0,
    ratingsSubmission: slice.ratingsSubmission,
    userId: slice.userId,
    refresh,
    refreshing,
    showInitialSkeleton: configured && loading && slice.matches.length === 0,
  };
}

export const TODAY_KEY = (today: Date) => dayKeyOf(today);
