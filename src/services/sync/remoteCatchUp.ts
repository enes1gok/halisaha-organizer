import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { reportError } from '../logging/reportError';

export type RemoteCatchUpReason = 'foreground' | 'background';

export type RemoteCatchUpResult =
  | { status: 'synced' }
  | { status: 'skipped'; reason: 'supabase_unconfigured' | 'store_not_hydrated' | 'unauthenticated' | 'throttled' };

type RemoteCatchUpOptions = {
  reason: RemoteCatchUpReason;
  now?: number;
  minIntervalMs?: number;
};

const STORAGE_KEY_PREFIX = '@halisaha/remote-catch-up';
const DEFAULT_MIN_INTERVAL_MS: Record<RemoteCatchUpReason, number> = {
  foreground: 3 * 60 * 1000,
  background: 60 * 60 * 1000,
};

function storageKey(reason: RemoteCatchUpReason): string {
  return `${STORAGE_KEY_PREFIX}:${reason}:last-run-ms`;
}

async function readLastRunMs(reason: RemoteCatchUpReason): Promise<number | null> {
  const raw = await AsyncStorage.getItem(storageKey(reason));
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function writeLastRunMs(reason: RemoteCatchUpReason, now: number): Promise<void> {
  await AsyncStorage.setItem(storageKey(reason), String(now));
}

async function hasSession(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return Boolean(data.session);
}

export async function runRemoteCatchUp(options: RemoteCatchUpOptions): Promise<RemoteCatchUpResult> {
  if (!isSupabaseConfigured()) return { status: 'skipped', reason: 'supabase_unconfigured' };
  if (!useAppStore.persist.hasHydrated()) return { status: 'skipped', reason: 'store_not_hydrated' };

  const now = options.now ?? Date.now();
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS[options.reason];
  const lastRunMs = await readLastRunMs(options.reason);
  if (lastRunMs !== null && now - lastRunMs < minIntervalMs) {
    return { status: 'skipped', reason: 'throttled' };
  }

  try {
    if (!(await hasSession())) return { status: 'skipped', reason: 'unauthenticated' };

    const state = useAppStore.getState();
    await Promise.all([state.hydrateRemoteMatches(), state.hydrateRemoteGroups()]);
    await writeLastRunMs(options.reason, now);
    return { status: 'synced' };
  } catch (error) {
    reportError({
      error,
      operation: 'remoteCatchUp',
      extra: { reason: options.reason },
    });
    throw error;
  }
}

export const remoteCatchUpInternals = {
  storageKey,
  readLastRunMs,
  writeLastRunMs,
};
