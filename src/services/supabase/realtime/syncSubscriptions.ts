import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { useAppStore } from '../../../store/useAppStore';
import { isRemoteMatchId } from '../../../utils/matchId';

const CHANNEL_NAME = 'app-remote-sync';

const MATCH_DEBOUNCE_MS = 320;
const GROUP_DEBOUNCE_MS = 400;

type PgRow = Record<string, unknown>;

type PgPayload = {
  new?: PgRow | null;
  old?: PgRow | null;
};

let channel: RealtimeChannel | null = null;
let clientRef: SupabaseClient | null = null;
const matchTimers = new Map<string, ReturnType<typeof setTimeout>>();
let groupsTimer: ReturnType<typeof setTimeout> | null = null;

function readUuid(value: unknown): string | null {
  return typeof value === 'string' && isRemoteMatchId(value) ? value : null;
}

function extractMatchId(table: string, payload: PgPayload): string | null {
  if (table === 'matches') {
    return readUuid(payload.new?.id ?? payload.old?.id);
  }
  return readUuid(payload.new?.match_id ?? payload.old?.match_id);
}

function clearMatchTimers(): void {
  for (const t of matchTimers.values()) clearTimeout(t);
  matchTimers.clear();
}

function scheduleMatchRefresh(matchId: string): void {
  const existing = matchTimers.get(matchId);
  if (existing) clearTimeout(existing);
  matchTimers.set(
    matchId,
    setTimeout(() => {
      matchTimers.delete(matchId);
      const state = useAppStore.getState();
      const known = state.matches.some((m) => m.id === matchId);
      const task = known
        ? state.refreshRemoteMatch(matchId)
        : state.hydrateRemoteMatches({ force: true });
      void Promise.resolve(task).catch((e) => {
        console.warn('Realtime maç senkronu başarısız', e);
      });
    }, MATCH_DEBOUNCE_MS),
  );
}

function scheduleGroupsHydrate(): void {
  if (groupsTimer) clearTimeout(groupsTimer);
  groupsTimer = setTimeout(() => {
    groupsTimer = null;
    void useAppStore.getState().hydrateRemoteGroups({ force: true }).catch((e) => {
      console.warn('Realtime grup senkronu başarısız', e);
    });
  }, GROUP_DEBOUNCE_MS);
}

function handleMatchGraphPayload(table: string, payload: PgPayload): void {
  const matchId = extractMatchId(table, payload);
  if (!matchId) return;
  scheduleMatchRefresh(matchId);
}

function attachPostgresHandlers(ch: RealtimeChannel): void {
  const matchTables = [
    'matches',
    'match_attendees',
    'match_team_players',
    'match_stat_lines',
    'self_report_requests',
  ] as const;

  for (const table of matchTables) {
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => handleMatchGraphPayload(table, payload as PgPayload),
    );
  }

  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
    scheduleGroupsHydrate();
  });

  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
    scheduleGroupsHydrate();
  });
}

/**
 * Postgres Realtime kanalını kapatır ve zamanlayıcıları temizler.
 * Oturum kapanırken veya istemci sıfırlanmadan önce çağrılmalıdır.
 */
export function stopRemoteRealtimeSync(): void {
  clearMatchTimers();
  if (groupsTimer) {
    clearTimeout(groupsTimer);
    groupsTimer = null;
  }
  if (channel && clientRef) {
    void clientRef.removeChannel(channel);
  }
  channel = null;
  clientRef = null;
}

/**
 * Oturum açıkken maç grafiği ve grup tabloları için postgres_changes dinler.
 * RLS ile uyumlu olaylar gelir; bilinen maçlar için {@link MatchesSlice.refreshRemoteMatch}, değilse tam liste yenilenir.
 */
export function startRemoteRealtimeSync(supabase: SupabaseClient): void {
  stopRemoteRealtimeSync();
  clientRef = supabase;
  const ch = supabase.channel(CHANNEL_NAME);
  attachPostgresHandlers(ch);
  ch.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') return;
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn('Realtime senkron kanalı', status, err?.message ?? err);
    }
  });
  channel = ch;
}
