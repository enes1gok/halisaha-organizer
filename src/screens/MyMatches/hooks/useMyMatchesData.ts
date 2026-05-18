import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startOfDay, startOfMonth } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import type { Match } from '../../../types/domain';
import { useAppStore } from '../../../store/useAppStore';
import { useSupabaseAuth } from '../../../context/SupabaseAuthContext';
import {
  buildAgendaSections,
  countMatchesBySegment,
  dayKeyOf,
  filterMatchesBySegment,
  groupMatchesByDay,
  shiftMonth,
  type AgendaSection,
  type SegmentCounts,
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
  segmentCounts: SegmentCounts;
  sections: AgendaSection[];
  hasAnyMatches: boolean;
  /** Boş «yaklaşan» liste için notGoing açıklaması göster */
  hasUpcomingNotGoingAttendance: boolean;
  ratingsSubmission: Record<string, true | undefined>;
  userId: string;
  refresh: () => Promise<void>;
  refreshing: boolean;
  showInitialSkeleton: boolean;
  fetchError: boolean;
  loadMore: () => void;
  loadingMore: boolean;
  hasMoreMatches: boolean;
};

export function useMyMatchesData(): UseMyMatchesData {
  const slice = useAppStore(
    useShallow((s) => ({
      matches: s.matches,
      userId: s.getCurrentUserId(),
      remoteUserId: s.remoteUserId,
      hydrateRemoteMatches: s.hydrateRemoteMatches,
      loadMoreRemoteMatches: s.loadMoreRemoteMatches,
      hasMoreRemoteMatches: s.hasMoreRemoteMatches,
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [skeletonExpired, setSkeletonExpired] = useState(false);

  useEffect(() => {
    const showInitialSkeleton = configured && loading && slice.matches.length === 0;
    if (!showInitialSkeleton) return;
    const timer = setTimeout(() => setSkeletonExpired(true), 8_000);
    return () => clearTimeout(timer);
  }, [configured, loading, slice.matches.length]);

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

  const segmentCounts = useMemo(() => countMatchesBySegment(mine, today), [mine, today]);

  const sections = useMemo(
    () => buildAgendaSections(mine, segment, today),
    [mine, segment, today],
  );

  /** Yaklaşan bir maçta (organizatör değilken) yalnızca «Gelmiyorum» ise liste filtrelendiği için boş görünebilir */
  const hasUpcomingNotGoingAttendance = useMemo(() => {
    const uid = slice.userId;
    return slice.matches.some(
      (m) =>
        m.status === 'upcoming' &&
        m.organizerId !== uid &&
        m.attendees.find((a) => a.playerId === uid)?.status === 'notGoing',
    );
  }, [slice.matches, slice.userId]);

  const refresh = useCallback(async () => {
    if (!slice.remoteUserId) return;
    setRefreshing(true);
    setFetchError(false);
    try {
      await slice.hydrateRemoteMatches({ force: true });
    } catch (e) {
      console.warn('MyMatches refresh failed', e);
      setFetchError(true);
    } finally {
      setRefreshing(false);
    }
  }, [slice.hydrateRemoteMatches, slice.remoteUserId]);

  const loadMore = useCallback(() => {
    if (loadingMore || !slice.hasMoreRemoteMatches) return;
    setLoadingMore(true);
    void slice.loadMoreRemoteMatches().finally(() => setLoadingMore(false));
  }, [loadingMore, slice.hasMoreRemoteMatches, slice.loadMoreRemoteMatches]);

  const handleSetSelectedDateKey = useCallback(
    (key: string | null) => {
      setSelectedDateKey(key);
      if (key) {
        const parts = key.split('-');
        if (parts.length === 3) {
          const [y, m] = parts.map((p) => Number.parseInt(p, 10));
          if (y !== undefined && m !== undefined && Number.isFinite(y) && Number.isFinite(m)) {
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
    segmentCounts,
    sections,
    hasAnyMatches: mine.length > 0,
    hasUpcomingNotGoingAttendance,
    ratingsSubmission: slice.ratingsSubmission,
    userId: slice.userId,
    refresh,
    refreshing,
    showInitialSkeleton: configured && loading && slice.matches.length === 0 && !skeletonExpired,
    fetchError,
    loadMore,
    loadingMore,
    hasMoreMatches: slice.hasMoreRemoteMatches,
  };
}

export const TODAY_KEY = (today: Date) => dayKeyOf(today);
